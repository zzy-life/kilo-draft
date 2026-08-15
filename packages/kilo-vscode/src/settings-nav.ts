import * as vscode from "vscode"

/** Settings tabs shown in the narrow activity-bar sidebar navigation. */
const TABS = [
  { tab: "providers", icon: `M10.0001 4.37562V2.875M13 4.37793V2.87793M7.00014 4.37793V2.875M10 17.1279V15.6279M13 17.1279V15.6279M7 17.1279V15.6279M15.625 13.0029H17.125M15.625 7.00293H17.125M15.625 10.0029H17.125M2.875 10.0029H4.375M2.875 13.0029H4.375M2.875 7.00293H4.375M4.375 4.37793H15.625V15.6279H4.375V4.37793ZM12.6241 10.0022C12.6241 11.4519 11.4488 12.6272 9.99908 12.6272C8.54934 12.6272 7.37408 11.4519 7.37408 10.0022C7.37408 8.55245 8.54934 7.3772 9.99908 7.3772C11.4488 7.3772 12.6241 8.55245 12.6241 10.0022Z`, stroke: true },
  { tab: "autocomplete", icon: `M2.08325 3.75H11.2499M14.5833 3.75H17.9166M2.08325 10L7.08325 10M10.4166 10L17.9166 10M2.08325 16.25L8.74992 16.25M12.0833 16.25L17.9166 16.25`, stroke: true },
  { tab: "commitMessage", icon: `M17.0832 17.0807V17.5807H17.5832V17.0807H17.0832ZM2.9165 17.0807H2.4165V17.5807H2.9165V17.0807ZM2.9165 2.91406V2.41406H2.4165V2.91406H2.9165ZM9.58317 3.41406H10.0832V2.41406H9.58317V2.91406V3.41406ZM17.5832 10.4141V9.91406H16.5832V10.4141H17.0832H17.5832ZM6.24984 11.2474L5.89628 10.8938L5.74984 11.0403V11.2474H6.24984ZM6.24984 13.7474H5.74984V14.2474H6.24984V13.7474ZM8.74984 13.7474V14.2474H8.95694L9.10339 14.101L8.74984 13.7474ZM15.2082 2.28906L15.5617 1.93551L15.2082 1.58196L14.8546 1.93551L15.2082 2.28906ZM17.7082 4.78906L18.0617 5.14262L18.4153 4.78906L18.0617 4.43551L17.7082 4.78906ZM17.0832 17.0807V16.5807H2.9165V17.0807V17.5807H17.0832V17.0807ZM2.9165 17.0807H3.4165V2.91406H2.9165H2.4165V17.0807H2.9165ZM2.9165 2.91406V3.41406H9.58317V2.91406V2.41406H2.9165V2.91406ZM17.0832 10.4141H16.5832V17.0807H17.0832H17.5832V10.4141H17.0832ZM6.24984 11.2474H5.74984V13.7474H6.24984H6.74984V11.2474H6.24984ZM6.24984 13.7474V14.2474H8.74984V13.7474V13.2474H6.24984V13.7474ZM6.24984 11.2474L6.60339 11.6009L15.5617 2.64262L15.2082 2.28906L14.8546 1.93551L5.89628 10.8938L6.24984 11.2474ZM15.2082 2.28906L14.8546 2.64262L17.3546 5.14262L17.7082 4.78906L18.0617 4.43551L15.5617 1.93551L15.2082 2.28906ZM17.7082 4.78906L17.3546 4.43551L8.39628 13.3938L8.74984 13.7474L9.10339 14.101L18.0617 5.14262L17.7082 4.78906Z`, stroke: false },
  { tab: "language", icon: `M18.3334 10.0003C18.3334 5.57324 15.0927 2.91699 10.0001 2.91699C4.90749 2.91699 1.66675 5.57324 1.66675 10.0003C1.66675 11.1497 2.45578 13.1016 2.5771 13.3949C2.5878 13.4207 2.59839 13.4444 2.60802 13.4706C2.69194 13.6996 3.04282 14.9364 1.66675 16.7684C3.5186 17.6538 5.48526 16.1982 5.48526 16.1982C6.84592 16.9202 8.46491 17.0837 10.0001 17.0837C15.0927 17.0837 18.3334 14.4274 18.3334 10.0003Z`, stroke: true },
  { tab: "aboutKiloCode", icon: `M7.91683 7.91927V6.2526H12.0835V8.7526L10.0002 10.0026V12.0859M10.0002 13.7526V13.7609M17.9168 10.0026C17.9168 14.3749 14.3724 17.9193 10.0002 17.9193C5.62791 17.9193 2.0835 14.3749 2.0835 10.0026C2.0835 5.63035 5.62791 2.08594 10.0002 2.08594C14.3724 2.08594 17.9168 5.63035 17.9168 10.0026Z`, stroke: true },
] as const

/**
 * Localized labels for the settings tabs, mirroring the webview i18n keys
 * (`settings.<tab>.title` in `webview-ui/src/i18n/`). The extension cannot
 * import the webview i18n dictionaries at runtime, so only the locales that
 * matter here (zh / zht / en) are embedded; anything else falls back to en.
 * Keep in sync with the values in `webview-ui/src/i18n/{en,zh,zht}.ts`.
 */
const TAB_LABELS: Record<string, Record<string, string>> = {
  zh: {
    providers: "提供商",
    autocomplete: "自动补全",
    commitMessage: "Git 提交信息",
    language: "语言",
    aboutKiloCode: "关于 Kilo Code",
  },
  zht: {
    providers: "供應商",
    autocomplete: "自動完成",
    commitMessage: "Commit Message",
    language: "語言",
    aboutKiloCode: "關於 Kilo Code",
  },
  en: {
    providers: "Providers",
    autocomplete: "Autocomplete",
    commitMessage: "Commit Message",
    language: "Language",
    aboutKiloCode: "About Kilo Code",
  },
}

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
 * Narrow sidebar navigation for the settings page, hosted as the Kilo
 * activity-bar container's only view (view id `kilo-code.SidebarProvider`).
 * The settings page itself no longer renders a navigation (moved here);
 * clicking an item opens the wide Settings editor panel (see
 * SettingsEditorProvider) on the selected tab.
 */
export class SettingsNavProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "kilo-code.SidebarProvider"

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly openSettings: (tab: string) => void,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }
    webviewView.webview.html = this.html()

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.type === "openSettings" && typeof message.tab === "string") {
        this.openSettings(message.tab)
      }
    })
  }

  private html(): string {
    const labels = TAB_LABELS[effectiveLocale()] ?? TAB_LABELS.en!
    const items = TABS.map(
      (t) => `<div class="item" data-tab="${t.tab}" role="button" tabindex="0">
  ${
    t.stroke
      ? `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-linecap="square" aria-hidden="true"><path d="${t.icon}"/></svg>`
      : `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="${t.icon}"/></svg>`
  }
  <span>${labels[t.tab]}</span>
</div>`,
    ).join("\n")

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  html, body { margin: 0; height: 100%; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); color: var(--vscode-foreground); font-family: var(--vscode-font-family); }
  body { display: flex; flex-direction: column; }
  .nav { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 8px; min-height: 0; overflow-y: auto; }
  .item { flex: 1 1 0; min-height: 40px; max-height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-radius: 6px; cursor: pointer; font-size: 13px; line-height: normal; white-space: nowrap; overflow: hidden; }
  .item:hover, .item:focus-visible { background: var(--vscode-list-hoverBackground); outline: none; }
  .item svg { width: 18px; height: 18px; flex-shrink: 0; color: var(--vscode-foreground); }
  .item span { overflow: hidden; text-overflow: ellipsis; }
</style>
</head>
<body>
<div class="nav">
${items}
</div>
<script>
  const vscode = acquireVsCodeApi();
  const act = (el) => vscode.postMessage({ type: "openSettings", tab: el.dataset.tab });
  document.querySelectorAll(".item").forEach((el) => {
    el.addEventListener("click", () => act(el));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(el); } });
  });
</script>
</body>
</html>`
  }
}
