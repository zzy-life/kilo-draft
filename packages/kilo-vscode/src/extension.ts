import * as vscode from "vscode"
import { KiloProvider } from "./KiloProvider"
import { SettingsEditorProvider } from "./SettingsEditorProvider"
import { EXTENSION_DISPLAY_NAME } from "./constants"
import { KiloConnectionService } from "./services/cli-backend"
import { registerAutocompleteProvider } from "./services/autocomplete"
import { ensureBackendForAutocomplete } from "./services/autocomplete/ensure-backend"
import { AutocompleteServiceManager } from "./services/autocomplete/AutocompleteServiceManager"
import { TelemetryEventName, TelemetryProxy } from "./services/telemetry"
import { registerCommitMessageService } from "./services/commit-message"
import { registerHeapSnapshot } from "./commands/heap-snapshot"
import { markWorkspace } from "./util/spotlight"
import { isCursorHost } from "./utils"

const panelTitleHandler = (panel: vscode.WebviewPanel) => (title: string) => {
  panel.title = title || EXTENSION_DISPLAY_NAME
}

// Activated via "onStartupFinished" and "onUri" (package.json) so that commands, code actions,
// keybindings, autocomplete, commit-message generation, and URI deep links all work immediately —
// without requiring the user to open a Kilo sidebar or panel first. The CLI backend is NOT spawned here;
// it starts lazily when a webview connects or when ensureBackendForAutocomplete() triggers it.
export function activate(context: vscode.ExtensionContext) {
  console.log("Kilo Code extension is now active")
  // Drives the "!kilo-code.new.isCursor" guards on the native view/title and
  // editor/title menu contributions — see isCursorHost() for why.
  void vscode.commands.executeCommand("setContext", "kilo-code.new.isCursor", isCursorHost())

  const telemetry = TelemetryProxy.getInstance()

  // Create shared connection service (one server for all webviews)
  const connectionService = new KiloConnectionService(context)

  // Configure telemetry and reload autocomplete when the backend reconnects.
  const unsubscribeStateChange = connectionService.onStateChange((state) => {
    if (state !== "connected") return
    const config = connectionService.getServerConfig()
    if (config) {
      telemetry.configure(config.baseUrl, config.password)
      // Sync the CLI's PostHog client with the current consent state. The
      // CLI reads KILO_TELEMETRY_LEVEL once at spawn, so without this call
      // a fresh CLI started while VS Code telemetry was off would stay
      // opted out for the rest of the session.
      telemetry.setEnabled(vscode.env.isTelemetryEnabled)
    }
    AutocompleteServiceManager.getInstance()?.load()
  })

  // Propagate runtime telemetry consent changes to the CLI subprocess so its
  // PostHog client stays in sync with the user's VS Code telemetry setting.
  context.subscriptions.push(
    vscode.env.onDidChangeTelemetryEnabled((enabled) => {
      telemetry.setEnabled(enabled)
    }),
  )

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    void markWorkspace(folder.uri.fsPath, (msg) => console.warn(`[Kilo New] ${msg}`))
  }

  // Track all open tab panel providers so toolbar button commands can target them.
  // NOTE: The editor/title toolbar for tab panels intentionally omits the Agent Manager
  // button (unlike the sidebar). Too many icons causes VS Code to
  // collapse them into a "..." overflow menu, hiding important buttons like Settings.
  const tabPanels = new Map<vscode.WebviewPanel, KiloProvider>()
  const activeTabProvider = () => {
    for (const [panel, p] of tabPanels) {
      if (panel.active) return p
    }
    return undefined
  }

  // Create the provider with shared service
  const provider = new KiloProvider(context.extensionUri, connectionService, context, {
    focusContext: "kilo-code.new.sidebarFocused",
  })

  // Register the webview view provider for the sidebar.
  // retainContextWhenHidden keeps the webview alive when switching to other sidebar panels.
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(KiloProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  ensureBackendForAutocomplete(connectionService)

  // Register serializer so "Open in Tab" restores when VS Code restarts
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer("kilo-code.new.TabPanel", {
      deserializeWebviewPanel(panel: vscode.WebviewPanel) {
        const tabProvider = new KiloProvider(context.extensionUri, connectionService, context, {
          tabTitle: panelTitleHandler(panel),
          topBarSurface: "tab",
        })
        tabProvider.resolveWebviewPanel(panel)
        tabPanels.set(panel, tabProvider)
        panel.onDidDispose(
          () => {
            console.log("[Kilo New] Tab panel restored from restart disposed")
            tabPanels.delete(panel)
            tabProvider.dispose()
          },
          null,
          context.subscriptions,
        )
        return Promise.resolve()
      },
    }),
  )

  // Create standalone editor providers (open in editor area, not sidebar)
  const settingsEditorProvider = new SettingsEditorProvider(context.extensionUri, connectionService, context)
  context.subscriptions.push(settingsEditorProvider)

  // Register serializers so standalone panels restore on restart
  const settingsViews = ["settingsPanel", "profilePanel"] as const
  for (const suffix of settingsViews) {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(`kilo-code.new.${suffix}`, {
        deserializeWebviewPanel(panel: vscode.WebviewPanel) {
          settingsEditorProvider.deserializePanel(panel)
          return Promise.resolve()
        },
      }),
    )
  }

  // Sidebar menus use wrapper commands so this event measures real title button presses,
  // not programmatic opens, shortcuts, or editor title commands.
  const track = (button: string, command: string) => {
    TelemetryProxy.capture(TelemetryEventName.TITLE_BUTTON_CLICKED, {
      button,
      surface: "sidebar_title",
    })
    void vscode.commands.executeCommand(command)
  }

  // Register toolbar button command handlers
  context.subscriptions.push(
    vscode.commands.registerCommand("kilo-code.new.sidebarTitle.plusButtonClicked", () => {
      track("new_task", "kilo-code.new.plusButtonClicked")
    }),
    vscode.commands.registerCommand("kilo-code.new.sidebarTitle.historyButtonClicked", () => {
      track("history", "kilo-code.new.historyButtonClicked")
    }),
    vscode.commands.registerCommand("kilo-code.new.sidebarTitle.profileButtonClicked", () => {
      track("profile", "kilo-code.new.profileButtonClicked")
    }),
    vscode.commands.registerCommand("kilo-code.new.sidebarTitle.settingsButtonClicked", () => {
      track("settings", "kilo-code.new.settingsButtonClicked")
    }),
    vscode.commands.registerCommand("kilo-code.new.plusButtonClicked", () => {
      const tab = activeTabProvider()
      if (tab) tab.postMessage({ type: "action", action: "plusButtonClicked" })
      else provider.postMessage({ type: "action", action: "plusButtonClicked" })
    }),
    vscode.commands.registerCommand("kilo-code.new.historyButtonClicked", () => {
      const tab = activeTabProvider()
      if (tab) tab.postMessage({ type: "action", action: "historyButtonClicked" })
      else provider.postMessage({ type: "action", action: "historyButtonClicked" })
    }),
    vscode.commands.registerCommand("kilo-code.new.cycleAgentMode", () => {
      const tab = activeTabProvider()
      if (tab) tab.postMessage({ type: "action", action: "cycleAgentMode" })
      else provider.postMessage({ type: "action", action: "cycleAgentMode" })
    }),
    vscode.commands.registerCommand("kilo-code.new.cyclePreviousAgentMode", () => {
      const tab = activeTabProvider()
      if (tab) tab.postMessage({ type: "action", action: "cyclePreviousAgentMode" })
      else provider.postMessage({ type: "action", action: "cyclePreviousAgentMode" })
    }),
    vscode.commands.registerCommand("kilo-code.new.profileButtonClicked", () => {
      settingsEditorProvider.openPanel("profile")
    }),
    vscode.commands.registerCommand("kilo-code.new.settingsButtonClicked", (tab?: string) => {
      settingsEditorProvider.openPanel("settings", tab)
    }),
    vscode.commands.registerCommand("kilo-code.new.openIndexingSettings", () => {
      settingsEditorProvider.openPanel("settings", "indexing")
    }),
    vscode.commands.registerCommand("kilo-code.new.showMemory", async () => {
      const target = activeTabProvider() ?? provider
      if (target === provider) await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus")
      await target.waitForReady()
      await target.showMemory()
    }),
    vscode.commands.registerCommand("kilo-code.new.toggleMemory", async () => {
      const target = activeTabProvider() ?? provider
      if (target === provider) await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus")
      await target.waitForReady()
      await target.toggleMemory()
    }),
    vscode.commands.registerCommand("kilo-code.new.generateTerminalCommand", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Describe the terminal command you want to generate",
        placeHolder: "e.g., find all .ts files modified in the last 24 hours",
      })
      if (!input) return
      await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus")
      await provider.waitForReady()
      provider.postMessage({ type: "triggerTask", text: `Generate a terminal command: ${input}` })
    }),
    vscode.commands.registerCommand("kilo-code.new.openInTab", () => {
      return openKiloInNewTab(context, connectionService, tabPanels)
    }),
  )

  // Register URI handler for extension deep links (vscode://kilocode.kilo-code/kilocode/...)
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        const sessionMatch = uri.path.match(/^\/kilocode\/s\/([a-zA-Z0-9_-]+)$/)
        const sessionId = sessionMatch?.[1]
        if (sessionId) {
          console.log("[Kilo New] URI handler: opening cloud session:", sessionId)
          await vscode.commands.executeCommand(`${KiloProvider.viewType}.focus`)
          provider.openCloudSession(sessionId)
          return
        }

        if (uri.path !== "/kilocode/switch" && uri.path !== "/kilocode/model") return
        const params = new URLSearchParams(uri.query)
        const modelID = params.get("model") || undefined
        const agent = params.get("agent") || undefined
        if (!modelID && !agent) return
        console.log("[Kilo New] URI handler: applying linked Kilo selection:", { modelID, agent })
        await vscode.commands.executeCommand(`${KiloProvider.viewType}.focus`)
        provider.selectKiloModel(modelID, agent)
      },
    }),
  )

  // Register autocomplete provider
  void registerAutocompleteProvider(context, connectionService)

  // Register commit message generation
  registerCommitMessageService(context, connectionService)

  registerHeapSnapshot(context, connectionService)

  context.subscriptions.push(
    vscode.commands.registerCommand("kilo-code.new.reload", () => {
      provider.reload().catch((e) => console.error("[Kilo New] reload command failed:", e))
    }),
  )

  // Dispose services when extension deactivates (kills the server)
  context.subscriptions.push({
    dispose: () => {
      unsubscribeStateChange()
      provider.dispose()
      connectionService.dispose()
    },
  })
}

export function deactivate() {
  TelemetryProxy.getInstance().shutdown()
}

function openKiloInNewTab(
  context: vscode.ExtensionContext,
  connectionService: KiloConnectionService,
  tabPanels: Map<vscode.WebviewPanel, KiloProvider>,
) {
  const panel = vscode.window.createWebviewPanel(
    "kilo-code.new.TabPanel",
    EXTENSION_DISPLAY_NAME,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri],
    },
  )

  panel.iconPath = {
    light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "kilo-light.svg"),
    dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "kilo-dark.svg"),
  }

  const tabProvider = new KiloProvider(context.extensionUri, connectionService, context, {
    tabTitle: panelTitleHandler(panel),
    topBarSurface: "tab",
  })
  tabProvider.resolveWebviewPanel(panel)
  tabPanels.set(panel, tabProvider)

  panel.onDidDispose(
    () => {
      console.log("[Kilo New] Tab panel disposed")
      tabPanels.delete(panel)
      tabProvider.dispose()
    },
    null,
    context.subscriptions,
  )
}
