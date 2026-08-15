import * as vscode from "vscode"

/**
 * Sidebar launcher for the activity-bar icon.
 *
 * Phase 5 removed the chat sidebar. The Kilo activity-bar container still hosts
 * a webview view so the icon is clickable, but the view no longer renders the
 * product UI. Clicking the icon instead opens the wide Settings editor panel
 * (the same panel the old "Settings" title-bar button opened) and collapses the
 * sidebar so only the wide settings page remains.
 */
export class SettingsLauncherProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "kilo-code.SidebarProvider"

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly openSettings: () => void,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }
    webviewView.webview.html = this.html()

    // Open the wide settings panel first, then collapse the sidebar so the
    // launcher doesn't linger as a narrow empty view. Defer the collapse so
    // VS Code finishes resolving the view before the sidebar closes.
    this.openSettings()
    setTimeout(() => {
      void vscode.commands.executeCommand("workbench.action.closeSidebar")
    }, 50)
  }

  private html(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  html, body { margin: 0; height: 100%; background: var(--vscode-editor-background); color: var(--vscode-foreground); }
  body { display: flex; align-items: center; justify-content: center; font-family: var(--vscode-font-family); font-size: 12px; }
  p { opacity: 0.7; }
</style>
</head>
<body><p>Opening Kilo Settings…</p></body>
</html>`
  }
}
