import { Component, createSignal, onMount, onCleanup } from "solid-js"
import Settings from "./components/settings/Settings"
import { useVSCode } from "./context/vscode"
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

const App: Component = () => {
  return (
    <ProviderShell.Root>
      <AppContent />
    </ProviderShell.Root>
  )
}

export default App
