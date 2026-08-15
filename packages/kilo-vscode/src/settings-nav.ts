import * as vscode from "vscode"
import { buildWebviewHtml } from "./utils"

/** Normalize a VS Code language id (e.g. `zh-cn`) to a Kilo locale id (`zh`). */
function localeFor(lang: string): string {
  if (lang === "zh-cn" || lang === "zh-sg" || lang === "zh") return "zh"
  if (lang === "zh-tw" || lang === "zh-hk" || lang === "zht") return "zht"
  if (lang === "en" || lang === "en-us") return "en"
  return lang
}

/** Effective Kilo UI locale: `kilo-code.new.language` override wins, else VS Code language. */
function effectiveLocale(): string {
  const override = vscode.workspace.getConfiguration("kilo-code.new").get<string>("language")
  return localeFor(override && override !== "" ? override : vscode.env.language)
}

/**
 * Narrow activity-bar sidebar for the settings page.
 *
 * The view is a full webview loading the same `dist/webview.js` bundle as the
 * wide settings panel; `App.tsx` switches to the settings-nav page when the
 * HTML bootstrap sets `window.KILO_SIDEBAR_NAV`. The webview resolves the label
 * locale itself through `LanguageProvider`, so switching the language in the
 * settings panel re-localizes the sidebar reactively (the provider re-pushes
 * the locale on `kilo-code.new.language` config changes).
 *
 * Clicking an item posts `openSettingsPanel` back here, which opens the wide
 * Settings editor panel on that tab (see SettingsEditorProvider).
 */
export class SettingsNavProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "kilo-code.SidebarProvider"

  private webview: vscode.Webview | null = null
  private disposables: vscode.Disposable[] = []

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly openSettings: (tab: string) => void,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    for (const d of this.disposables) d.dispose()
    this.disposables = []

    this.webview = webviewView.webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }
    webviewView.webview.html = this.html(webviewView.webview)

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage((message) => {
        if (message?.type === "webviewReady") {
          this.pushLocale()
        } else if (message?.type === "openSettingsPanel" && typeof message.tab === "string") {
          this.openSettings(message.tab)
        }
      }),
      webviewView.onDidDispose(() => {
        this.webview = null
      }),
      // Re-localize the sidebar whenever the language setting changes. This
      // covers both the settings panel flow (LanguageTab -> setLanguage writes
      // kilo-code.new.language) and direct edits in VS Code settings JSON.
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("kilo-code.new.language")) this.pushLocale()
      }),
    )
  }

  private pushLocale(): void {
    if (!this.webview) return
    void this.webview.postMessage({ type: "navLanguage", locale: effectiveLocale() }).then(undefined, (err) => {
      console.error("[Kilo New] SettingsNavProvider: postMessage failed", err)
    })
  }

  private html(webview: vscode.Webview): string {
    return buildWebviewHtml(webview, {
      scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js")),
      styleUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview.css")),
      iconsBaseUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "assets", "icons")),
      workerUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "shiki-worker.js")),
      title: "Kilo Settings",
      // The narrow sidebar never shows the native toolbar and renders the
      // settings-nav page instead of the full settings panel.
      topBar: false,
      extraGlobals: "window.KILO_SIDEBAR_NAV = true;",
    })
  }
}
