import { Component, createSignal, createEffect, createMemo, on, Show } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Tabs } from "@kilocode/kilo-ui/tabs"
import { Button } from "@kilocode/kilo-ui/button"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { showToast } from "@kilocode/kilo-ui/toast"
import { useVSCode } from "../../context/vscode"
import { useLanguage } from "../../context/language"
import { useConfig } from "../../context/config"
import { useSession } from "../../context/session"
import ProvidersTab from "./ProvidersTab"
import AutocompleteTab from "./AutocompleteTab"
import CommitMessageTab from "./CommitMessageTab"
import LanguageTab from "./LanguageTab"
import AboutKiloCodeTab from "./AboutKiloCodeTab"
import { useServer } from "../../context/server"
import type { MigrationSource } from "../../types/messages"
import { configMessage } from "../../utils/open-config"

export interface SettingsProps {
  tab?: string
  onTabChange?: (tab: string) => void
  onMigrationClick?: (source: MigrationSource) => void // legacy-migration
}

const Settings: Component<SettingsProps> = (props) => {
  const server = useServer()
  const language = useLanguage()
  const vscode = useVSCode()
  const { isDirty, saving, saveError, saveConfig, discardConfig } = useConfig()
  const session = useSession()
  const visibleTabs = new Set(["providers", "autocomplete", "commitMessage", "language", "aboutKiloCode"])
  const initialTab = props.tab && visibleTabs.has(props.tab) ? props.tab : "providers"
  const [active, setActive] = createSignal(initialTab)
  const [errorExpanded, setErrorExpanded] = createSignal(false)

  const busyCount = () => Object.values(session.allStatusMap()).filter((s) => s.type === "busy").length

  const handleSave = () => {
    const busy = busyCount()
    if (busy === 0) {
      saveConfig()
      return
    }
    const msg = busy === 1 ? language.t("settings.saveBar.warning.one") : language.t("settings.saveBar.warning.many")
    showToast({
      variant: "error",
      title: msg,
      persistent: true,
      actions: [
        { label: language.t("settings.saveBar.saveAnyway"), onClick: saveConfig },
        { label: language.t("settings.saveBar.cancel"), onClick: "dismiss" },
      ],
    })
  }

  const open = (scope: "local" | "global") => {
    vscode.postMessage(configMessage(scope, language.t))
  }

  // Sync when the parent changes the tab prop (e.g. via navigate message)
  createEffect(
    on(
      () => props.tab,
      (tab) => {
        if (tab) setActive(visibleTabs.has(tab) ? tab : "providers")
      },
    ),
  )

  const onTabChange = (tab: string) => {
    setActive(tab)
    props.onTabChange?.(tab)
    vscode.postMessage({ type: "settingsTabChanged", tab })
  }

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", "min-height": 0 }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          "border-bottom": "1px solid var(--border-weak-base)",
          display: "flex",
          "align-items": "center",
          "flex-wrap": "wrap",
          gap: "8px",
        }}
      >
        <h2 style={{ "font-size": "var(--kilo-font-size-16)", "font-weight": "600", margin: 0, flex: 1 }}>
          {language.t("sidebar.settings")}
        </h2>
        <Button variant="secondary" size="small" icon="edit" onClick={() => open("local")}>
          {language.t("settings.openLocalConfig")}
        </Button>
        <Button variant="secondary" size="small" icon="edit" onClick={() => open("global")}>
          {language.t("settings.openGlobalConfig")}
        </Button>
        <Tooltip value={language.t("common.reloadDescription")} placement="bottom">
          <Button variant="secondary" size="small" onClick={() => vscode.postMessage({ type: "reload" })}>
            <Icon name="reload" size="small" />
            {language.t("common.reload")}
          </Button>
        </Tooltip>
      </div>

      {/* Settings tabs */}
      <Tabs
        orientation="vertical"
        variant="settings"
        value={active()}
        onChange={onTabChange}
        style={{ flex: 1, overflow: "hidden" }}
      >
        <Tabs.List>
          <Tabs.Trigger value="providers" aria-label={language.t("settings.providers.title")}>
            <Icon name="providers" />
            <span class="label">{language.t("settings.providers.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="autocomplete" aria-label={language.t("settings.autocomplete.title")}>
            <Icon name="code-lines" />
            <span class="label">{language.t("settings.autocomplete.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="commitMessage" aria-label={language.t("settings.commitMessage.title")}>
            <Icon name="edit" />
            <span class="label">{language.t("settings.commitMessage.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="language" aria-label={language.t("settings.language.title")}>
            <Icon name="speech-bubble" />
            <span class="label">{language.t("settings.language.title")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="aboutKiloCode" aria-label={language.t("settings.aboutKiloCode.title")}>
            <Icon name="help" />
            <span class="label">{language.t("settings.aboutKiloCode.title")}</span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="providers">
          <h3>{language.t("settings.providers.title")}</h3>
          <ProvidersTab />
        </Tabs.Content>
        <Tabs.Content value="autocomplete">
          <h3>{language.t("settings.autocomplete.title")}</h3>
          <AutocompleteTab />
        </Tabs.Content>
        <Tabs.Content value="commitMessage">
          <h3>{language.t("settings.commitMessage.title")}</h3>
          <CommitMessageTab />
        </Tabs.Content>
        <Tabs.Content value="language">
          <h3>{language.t("settings.language.title")}</h3>
          <LanguageTab />
        </Tabs.Content>
        <Tabs.Content value="aboutKiloCode">
          <h3>{language.t("settings.aboutKiloCode.title")}</h3>
          <AboutKiloCodeTab
            port={server.serverInfo()?.port ?? null}
            connectionState={server.connectionState()}
            extensionVersion={server.extensionVersion()}
            onMigrationClick={props.onMigrationClick}
          />
        </Tabs.Content>
      </Tabs>

      {/* Save bar — slides in when there are unsaved config changes */}
      <Show when={isDirty()}>
        <div class="settings-save-bar-wrap">
          <Show when={saveError()}>
            {(err) => (
              <div class="settings-save-bar-error">
                <div
                  class="settings-save-bar-error-header"
                  onClick={() => setErrorExpanded((v) => !v)}
                  role="button"
                  aria-expanded={errorExpanded()}
                >
                  <span
                    class={`settings-save-bar-error-chevron${
                      errorExpanded() ? " settings-save-bar-error-chevron-expanded" : ""
                    }`}
                  >
                    <Icon name="chevron-right" size="small" />
                  </span>
                  <span class="settings-save-bar-error-title">
                    {language.t("settings.saveBar.saveFailed")}:{" "}
                    <span class="settings-save-bar-error-firstline">{err().message}</span>
                  </span>
                </div>
                <Show when={errorExpanded()}>
                  <pre class="settings-save-bar-error-details">{err().details ?? err().message}</pre>
                </Show>
              </div>
            )}
          </Show>
          <div class="settings-save-bar">
            <span class="settings-save-bar-label">{language.t("settings.saveBar.unsavedChanges")}</span>
            <Button variant="ghost" size="small" onClick={discardConfig} disabled={saving()}>
              {language.t("settings.saveBar.discard")}
            </Button>
            <Button variant="primary" size="small" onClick={handleSave} disabled={saving()}>
              {saving() ? language.t("settings.saveBar.saving") : language.t("settings.saveBar.save")}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default Settings
