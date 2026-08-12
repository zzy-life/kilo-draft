import { Component } from "solid-js"
import { Switch } from "@kilocode/kilo-ui/switch"
import { Card } from "@kilocode/kilo-ui/card"
import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import { ModelSelectorBase } from "../shared/ModelSelector"
import SettingsRow from "./SettingsRow"
import { AUTOCOMPLETE_SELECTOR_MODELS, getAutocompleteSelection } from "./autocomplete-model-selector"

const AutocompleteTab: Component = () => {
  const { settings, updateSetting } = useConfig()
  const language = useLanguage()

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
        >
          <ModelSelectorBase
            value={getAutocompleteSelection(autocompleteProvider(), autocompleteModel())}
            onSelect={selectModel}
            placement="bottom-start"
            models={AUTOCOMPLETE_SELECTOR_MODELS}
            favorites={false}
            allowClear
            clearLabel={language.t("settings.providers.notSet")}
            label={language.t("settings.autocomplete.model.title")}
            description={language.t("settings.autocomplete.model.description")}
          />
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
