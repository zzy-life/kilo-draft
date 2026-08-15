import * as vscode from "vscode"
import { SettingsProvider } from "./SettingsProvider"
import { resolvePanelProjectDirectory } from "./project-directory"
import type { KiloConnectionService } from "./services/cli-backend"

type PanelView = "settings"

const PANEL_TITLES: Record<PanelView, string> = {
  settings: "Kilo Settings",
}

/**
 * Opens the Settings page as an editor-area WebviewPanel (wide UI),
 * reached from the activity-bar launcher or the command palette.
 *
 * Each view type is a singleton panel — calling openPanel() again
 * reveals the existing panel instead of creating a duplicate.
 *
 * Uses a minimal SettingsProvider under the hood so the panel has
 * the settings backend connectivity (config, providers, auth) it needs.
 * The chat sidebar and KiloProvider were removed in Phase 5.
 */
export class SettingsEditorProvider implements vscode.Disposable {
  private panels = new Map<PanelView, vscode.WebviewPanel>()
  private providers = new Map<PanelView, SettingsProvider>()
  private tabs = new Map<PanelView, string>()

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly connectionService: KiloConnectionService,
    private readonly context: vscode.ExtensionContext,
  ) {}

  private getProjectDirectory(): string | null {
    const editor = vscode.window.activeTextEditor
    const active =
      editor?.document.uri.scheme === "file"
        ? vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath
        : undefined
    return resolvePanelProjectDirectory(active, vscode.workspace.workspaceFolders)
  }

  /** Extract the PanelView from a viewType string like "kilo-code.new.settingsPanel". */
  static viewFromType(type: string): PanelView | undefined {
    return type === "kilo-code.new.settingsPanel" ? "settings" : undefined
  }

  openPanel(view: PanelView, tab?: string): void {
    if (tab) this.tabs.set(view, tab)

    const projectDirectory = this.getProjectDirectory()
    const existing = this.panels.get(view)
    if (existing) {
      this.providers.get(view)?.setProjectDirectory(projectDirectory)
      if (tab) {
        const provider = this.providers.get(view)
        provider?.postMessage({ type: "navigate", view, tab })
      }
      existing.reveal(vscode.ViewColumn.Active)
      this.providers.get(view)?.postMessage({ type: "navigate", view, ...(tab ? { tab } : {}) })
      return
    }

    const panel = vscode.window.createWebviewPanel(
      `kilo-code.new.${view}Panel`,
      PANEL_TITLES[view],
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      },
    )

    this.wirePanel(panel, view, projectDirectory)
  }

  /** Re-wire a deserialized panel after extension restart. */
  deserializePanel(panel: vscode.WebviewPanel): void {
    const view = SettingsEditorProvider.viewFromType(panel.viewType)
    if (!view) {
      panel.dispose()
      return
    }
    this.wirePanel(panel, view, this.getProjectDirectory())
  }

  private wirePanel(panel: vscode.WebviewPanel, view: PanelView, projectDirectory: string | null): void {
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.extensionUri, "assets", "icons", "kilo-light.svg"),
      dark: vscode.Uri.joinPath(this.extensionUri, "assets", "icons", "kilo-dark.svg"),
    }

    // Create a dedicated SettingsProvider for this panel so it has
    // backend connectivity (config, providers, auth) for the settings page.
    const provider = new SettingsProvider(this.extensionUri, this.connectionService, this.context, {
      projectDirectory,
      hideTopBar: true,
    })
    provider.resolveWebviewPanel(panel)

    // Listen for closePanel from the webview (back button in panel mode)
    const closePanelDisposable = panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "closePanel") {
        panel.dispose()
      }
    })

    // Navigate to the target view on every webviewReady (including after
    // "Developer: Reload Webviews" which re-creates the JS context).
    const readyDisposable = panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "webviewReady") {
        // Small delay to let SettingsProvider's own webviewReady handler finish first
        setTimeout(() => {
          provider.postMessage({ type: "navigate", view, tab: this.tabs.get(view) })
        }, 50)
      }
    })

    // Remember the active settings tab so it survives webview reloads.
    const tabDisposable = panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "settingsTabChanged" && typeof msg.tab === "string") {
        this.tabs.set(view, msg.tab)
      }
    })

    this.panels.set(view, panel)
    this.providers.set(view, provider)

    const title = PANEL_TITLES[view]
    panel.onDidDispose(() => {
      console.log(`[Kilo New] ${title} panel disposed`)
      closePanelDisposable.dispose()
      readyDisposable.dispose()
      tabDisposable.dispose()
      provider.dispose()
      this.panels.delete(view)
      this.providers.delete(view)
      this.tabs.delete(view)
    })
  }

  dispose(): void {
    for (const [, panel] of this.panels) {
      panel.dispose()
    }
    this.panels.clear()
    this.providers.clear()
    this.tabs.clear()
  }
}
