import { Component, Show, createSignal, createMemo } from "solid-js"
import { Switch } from "@kilocode/kilo-ui/switch"
import { TextField } from "@kilocode/kilo-ui/text-field"
import { Button } from "@kilocode/kilo-ui/button"
import { Card } from "@kilocode/kilo-ui/card"
import { Select } from "@kilocode/kilo-ui/select"
import { useConfig } from "../../context/config"
import { useLanguage, LOCALES, LOCALE_LABELS } from "../../context/language"
import { useProvider } from "../../context/provider"
import type { Locale } from "../../context/language"
import { parseModelString } from "../../../../src/shared/provider-model"
import { ModelSelectorBase } from "../shared/ModelSelector"
import SettingsRow from "./SettingsRow"

const SYNC = "sync"
const opts = [SYNC, ...LOCALES] as const
type Option = typeof SYNC | Locale

interface CommitMessageTabProps {
  onProvidersClick?: () => void
}

const CommitMessageTab: Component<CommitMessageTabProps> = (props) => {
  const { config, updateConfig, settings, updateSetting } = useConfig()
  const language = useLanguage()
  const provider = useProvider()

  const langValue = () => settings().languageCommitMessage ?? SYNC

  const [expanded, setExpanded] = createSignal(Boolean(config().commit_message?.prompt))

  const updateCommitMessage = (value: { model?: string | null; prompt?: string }) => {
    updateConfig({ commit_message: { ...config().commit_message, ...value } })
  }

  const selectModel = (providerID: string, modelID: string) => {
    updateCommitMessage({ model: providerID && modelID ? `${providerID}/${modelID}` : null })
  }

  const toggle = (checked: boolean) => {
    setExpanded(checked)
    if (!checked) updateCommitMessage({ prompt: "" })
  }

  const label = (opt: Option) =>
    opt === SYNC ? language.t("settings.commitMessage.language.sync") : LOCALE_LABELS[opt]

  const value = (opt: Option) => opt

  const onSelect = (opt: Option | undefined) => {
    if (opt !== undefined) updateSetting("languageCommitMessage", opt)
  }

  const connected = createMemo(() => new Set(provider.connected()))
  const configured = createMemo(() => provider.models().some((model) => connected().has(model.providerID)))
  const currentLabel = createMemo(() => label(langValue() as Option))

  return (
    <Card>
      <div style={{ padding: "16px" }}>
        <SettingsRow
          title={language.t("settings.commitMessage.model.title")}
          description={language.t("settings.commitMessage.model.description")}
          last
          wide
        >
          <div class="settings-model-control">
            <Show when={!configured()}>
              <div class="settings-model-notice">
                <span>{language.t("settings.models.providerRequired")}</span>
                <Button size="small" variant="secondary" onClick={props.onProvidersClick}>
                  {language.t("settings.providers.title")}
                </Button>
              </div>
            </Show>
            <div class="settings-model-selector">
              <ModelSelectorBase
                value={parseModelString(config().commit_message?.model ?? undefined)}
                onSelect={selectModel}
                placement="bottom-start"
                models={provider.models()}
                disabledModels={(model) => !connected().has(model.providerID)}
                disabledModelLabel={language.t("settings.models.providerNotConfigured")}
                favorites={false}
                allowClear
                clearLabel={language.t("settings.providers.notSet")}
                label={language.t("settings.commitMessage.model.title")}
                description={language.t("settings.commitMessage.model.description")}
              />
            </div>
          </div>
        </SettingsRow>
      </div>

      <div style={{ "border-bottom": "1px solid var(--border-weak-base)" }} />

      <div style={{ padding: "16px" }}>
        <p style={{ "font-size": "var(--kilo-font-size-13)", "margin-bottom": "12px" }}>
          {language.t("settings.commitMessage.language.description")}
        </p>
        <Select
          options={[...opts]}
          current={langValue() as Option}
          label={label}
          value={value}
          onSelect={onSelect}
          variant="secondary"
          size="large"
        />
        <p
          style={{
            "font-size": "var(--kilo-font-size-12)",
            color: "var(--vscode-descriptionForeground)",
            "margin-top": "8px",
          }}
        >
          {language.t("settings.language.current")} {currentLabel()}
        </p>
      </div>

      <div style={{ "border-bottom": "1px solid var(--border-weak-base)" }} />

      <div style={{ padding: "16px" }}>
        <SettingsRow
          title={language.t("settings.commitMessage.override.title")}
          description={language.t("settings.commitMessage.override.description")}
          last={!expanded()}
        >
          <Switch checked={expanded()} onChange={toggle} hideLabel>
            {language.t("settings.commitMessage.override.title")}
          </Switch>
        </SettingsRow>

        <Show when={expanded()}>
          <div style={{ "padding-top": "8px" }}>
            <div data-slot="settings-row-label-title" style={{ "margin-bottom": "4px" }}>
              {language.t("settings.commitMessage.prompt.title")}
            </div>
            <div data-slot="settings-row-label-subtitle" style={{ "margin-bottom": "8px" }}>
              {language.t("settings.commitMessage.prompt.description")}
            </div>
            <div style={{ "max-height": "300px", overflow: "auto" }}>
              <TextField
                value={config().commit_message?.prompt ?? ""}
                placeholder={language.t("settings.commitMessage.prompt.placeholder")}
                multiline
                onChange={(val) => {
                  updateCommitMessage({ prompt: val })
                }}
              />
            </div>
          </div>
        </Show>
      </div>
    </Card>
  )
}

export default CommitMessageTab
