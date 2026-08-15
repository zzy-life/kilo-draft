import { Component, createSignal, onMount, onCleanup } from "solid-js"
import Settings from "./components/settings/Settings"
import SettingsNav from "./components/settings/SettingsNav"
import { VSCodeProvider, useVSCode } from "./context/vscode"
import { LanguageProvider } from "./context/language"
import { ProviderShell } from "./context/provider-shell"
// Style entrypoint: `chat.css` @imports every webview stylesheet (including
// settings.css, model-selector.css, dialogs.css). Keep the import so the
// settings page keeps its styles; the file name is legacy from the chat era.
import "./styles/chat.css"

/**
 * Settings-only root for the product webview. The former chat/history/profile
 * views were removed in Phase 5 (repository reduction); the webview now serves
 * only the minimal configuration entry (Base URL / API Key / Model / autocomplete
 * / commit-message language) for the two preserved features.
 *
 * The extension drives the active settings tab via a `navigate` message
 * (see SettingsEditorProvider), and the webview reports tab changes back via
 * `settingsTabChanged`.
 */
const AppContent: Component = () => {
  const [settingsTab, setSettingsTab] = createSignal<string | undefined>()
  const vscode = useVSCode()

  onMount(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data
      if (message?.type === "navigate" && message.view === "settings") {
        if (message.tab) setSettingsTab(message.tab)
        vscode.postMessage({ type: "settingsTabChanged", tab: message.tab })
      }
    }
    window.addEventListener("message", handler)
    onCleanup(() => window.removeEventListener("message", handler))
  })

  return (
    <div class="container">
      <Settings tab={settingsTab()} onTabChange={setSettingsTab} />
    </div>
  )
}

/**
 * Settings-nav webview for the narrow activity-bar sidebar. Only the language
 * plumbing is needed here (no backend): the extension pushes the effective
 * locale via `navLanguage` on `webviewReady` and whenever `kilo-code.new.language`
 * changes, so labels re-localize reactively.
 */
const SettingsNavApp: Component = () => (
  <VSCodeProvider>
    <SettingsNavInner />
  </VSCodeProvider>
)

const SettingsNavInner: Component = () => {
  const vscode = useVSCode()
  const [locale, setLocale] = createSignal<string | undefined>()

  onMount(() => {
    const unsubscribe = vscode.onMessage((message) => {
      if (message.type === "navLanguage" && typeof message.locale === "string") setLocale(message.locale)
    })
    // Handshake: the extension pushes the initial locale after this ready.
    vscode.postMessage({ type: "webviewReady" })
    onCleanup(unsubscribe)
  })

  return (
    <LanguageProvider languageOverride={locale}>
      <SettingsNav />
    </LanguageProvider>
  )
}

const App: Component = () => {
  // The sidebar bootstrap sets KILO_SIDEBAR_NAV; render the settings list page
  // there instead of the full settings panel.
  const navMode =
    typeof window !== "undefined" && (window as unknown as { KILO_SIDEBAR_NAV?: boolean }).KILO_SIDEBAR_NAV === true
  return navMode ? <SettingsNavApp /> : (
    <ProviderShell.Root>
      <AppContent />
    </ProviderShell.Root>
  )
}

export default App
