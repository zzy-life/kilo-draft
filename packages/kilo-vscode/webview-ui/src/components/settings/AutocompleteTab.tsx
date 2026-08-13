import { Component, Show, createMemo } from "solid-js"
import { Switch } from "@kilocode/kilo-ui/switch"
import { Button } from "@kilocode/kilo-ui/button"
import { Card } from "@kilocode/kilo-ui/card"
import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import { useProvider } from "../../context/provider"
import { ModelSelectorBase } from "../shared/ModelSelector"
import SettingsRow from "./SettingsRow"
import { AUTOCOMPLETE_SELECTOR_MODELS, getAutocompleteSelection } from "./autocomplete-model-selector"

interface AutocompleteTabProps {
  onProvidersClick?: () => void
}

const AutocompleteTab: Component<AutocompleteTabProps> = (props) => {
  const { settings, updateSetting } = useConfig()
  const language = useLanguage()
  const provider = useProvider()
  const connected = createMemo(() => new Set(provider.connected()))
  const configured = createMemo(() => AUTOCOMPLETE_SELECTOR_MODELS.some((model) => connected().has(model.providerID)))

  const enabled = (key: string, fallback: boolean) => Boolean(settings()[key] ?? fallback)
  const autocompleteProvider = () => {
    const value = settings()["autocomplete.provider"]
    return typeof value === "string" ? value : undefined
  }
  const autocompleteModel = () => {
    const value = settings()["autocomplete.model"]
    return typeof value === "string" ? value : undefined
  }

  const selectModel = (providerID: string, modelID: string) => {
    updateSetting("autocomplete.provider", providerID || null)
    updateSetting("autocomplete.model", modelID || null)
  }

  const save = (
    key: "enableAutoTrigger" | "enableSmartInlineTaskKeybinding" | "enableChatAutocomplete",
    value: boolean,
  ) => {
    updateSetting(`autocomplete.${key}`, value)
  }

  return (
    <div data-component="autocomplete-settings">
      <Card>
        <SettingsRow
          title={language.t("settings.autocomplete.model.title")}
          description={language.t("settings.autocomplete.model.description")}
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
                value={getAutocompleteSelection(autocompleteProvider(), autocompleteModel())}
                onSelect={selectModel}
                placement="bottom-start"
                models={AUTOCOMPLETE_SELECTOR_MODELS}
                disabledModels={(model) => !connected().has(model.providerID)}
                disabledModelLabel={language.t("settings.models.providerNotConfigured")}
                favorites={false}
                allowClear
                clearLabel={language.t("settings.providers.notSet")}
                label={language.t("settings.autocomplete.model.title")}
                description={language.t("settings.autocomplete.model.description")}
              />
            </div>
          </div>
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.autocomplete.autoTrigger.title")}
          description={language.t("settings.autocomplete.autoTrigger.description")}
        >
          <Switch
            checked={enabled("autocomplete.enableAutoTrigger", true)}
            onChange={(checked) => save("enableAutoTrigger", checked)}
            hideLabel
          >
            {language.t("settings.autocomplete.autoTrigger.title")}
          </Switch>
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.autocomplete.smartKeybinding.title")}
          description={language.t("settings.autocomplete.smartKeybinding.description")}
        >
          <Switch
            checked={enabled("autocomplete.enableSmartInlineTaskKeybinding", false)}
            onChange={(checked) => save("enableSmartInlineTaskKeybinding", checked)}
            hideLabel
          >
            {language.t("settings.autocomplete.smartKeybinding.title")}
          </Switch>
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.autocomplete.chatAutocomplete.title")}
          description={language.t("settings.autocomplete.chatAutocomplete.description")}
          last
        >
          <Switch
            checked={enabled("autocomplete.enableChatAutocomplete", false)}
            onChange={(checked) => save("enableChatAutocomplete", checked)}
            hideLabel
          >
            {language.t("settings.autocomplete.chatAutocomplete.title")}
          </Switch>
        </SettingsRow>
      </Card>
    </div>
  )
}

export default AutocompleteTab
