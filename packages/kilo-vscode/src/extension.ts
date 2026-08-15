import * as vscode from "vscode"
import { SettingsEditorProvider } from "./SettingsEditorProvider"
import { SettingsNavProvider } from "./settings-nav"
import { KiloConnectionService } from "./services/cli-backend"
import { registerAutocompleteProvider } from "./services/autocomplete"
import { ensureBackendForAutocomplete } from "./services/autocomplete/ensure-backend"
import { AutocompleteServiceManager } from "./services/autocomplete/AutocompleteServiceManager"
import { TelemetryProxy } from "./services/telemetry"
import { registerCommitMessageService } from "./services/commit-message"
import { registerHeapSnapshot } from "./commands/heap-snapshot"
import { markWorkspace } from "./util/spotlight"

// Activated via "onStartupFinished" and "onUri" (package.json) so that commands,
// autocomplete, and commit-message generation work immediately. The CLI backend
// is NOT spawned here; it starts lazily when the settings webview connects or
// when ensureBackendForAutocomplete() triggers it.
export function activate(context: vscode.ExtensionContext) {
  console.log("Kilo Code extension is now active")

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

  // Standalone settings editor panel — opens in the editor area (wide UI).
  const settingsEditorProvider = new SettingsEditorProvider(context.extensionUri, connectionService, context)
  context.subscriptions.push(settingsEditorProvider)

  // The activity-bar container hosts the settings navigation as a narrow
  // sidebar: clicking an item opens the wide Settings editor panel on that
  // tab while keeping the sidebar open for quick tab switching.
  const settingsNav = new SettingsNavProvider(context.extensionUri, (tab) => {
    settingsEditorProvider.openPanel("settings", tab)
  })
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SettingsNavProvider.viewType, settingsNav, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  // Register serializers so standalone panels restore on restart
  const settingsViews = ["settingsPanel"] as const
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

  // Settings entry command, also reachable from the command palette.
  context.subscriptions.push(
    vscode.commands.registerCommand("kilo-code.new.settingsButtonClicked", (tab?: string) => {
      settingsEditorProvider.openPanel("settings", tab)
    }),
  )

  ensureBackendForAutocomplete(connectionService)

  // Register autocomplete provider
  void registerAutocompleteProvider(context, connectionService)

  // Register commit message generation
  registerCommitMessageService(context, connectionService)

  registerHeapSnapshot(context, connectionService)

  // Dispose services when extension deactivates (kills the server)
  context.subscriptions.push({
    dispose: () => {
      unsubscribeStateChange()
      connectionService.dispose()
    },
  })
}

export function deactivate() {
  TelemetryProxy.getInstance().shutdown()
}
