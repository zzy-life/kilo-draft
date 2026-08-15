/** @jsxImportSource solid-js */
/**
 * Stories for Settings and ProvidersTab components.
 * Chat-only settings tabs (ModelsTab, AgentBehaviourTab, IndexingTab, etc.)
 * were removed in Phase 5, so only the retained tabs have stories.
 */

import { onMount } from "solid-js"
import type { Meta, StoryObj } from "storybook-solidjs-vite"
import { StoryProviders } from "./StoryProviders"
import Settings from "../components/settings/Settings"
import ProvidersTab from "../components/settings/ProvidersTab"
import CustomProviderDialog from "../components/settings/CustomProviderDialog"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"

const meta: Meta = {
  title: "Settings",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

function noop() {}

export const SettingsPanel: Story = {
  name: "Settings — full panel",
  render: () => (
    <StoryProviders>
      <div style={{ height: "700px", display: "flex", "flex-direction": "column" }}>
        <Settings />
      </div>
    </StoryProviders>
  ),
}

export const ProvidersConfigure: Story = {
  name: "ProvidersTab — no providers configured",
  render: () => (
    <StoryProviders>
      <div style={{ "max-height": "700px", overflow: "auto" }}>
        <ProvidersTab />
      </div>
    </StoryProviders>
  ),
}

/** Opens the Disabled Providers collapsible on mount so the expanded list has coverage. */
function OpenDisabledProviders() {
  let ref: HTMLDivElement | undefined
  onMount(() => {
    requestAnimationFrame(() => {
      ref?.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')?.click()
    })
  })
  return (
    <div ref={ref} style={{ "max-height": "700px", overflow: "auto" }}>
      <ProvidersTab />
    </div>
  )
}

export const ProvidersDisabledExpanded: Story = {
  name: "ProvidersTab — disabled providers expanded",
  render: () => (
    <StoryProviders config={{ disabled_providers: ["openai", "anthropic"] } as any}>
      <OpenDisabledProviders />
    </StoryProviders>
  ),
}

function CustomProviderDialogMount(props: { existing?: Parameters<typeof CustomProviderDialog>[0]["existing"] }) {
  const dialog = useDialog()
  onMount(() => dialog.show(() => <CustomProviderDialog existing={props.existing} />))
  return null
}

export const CustomProviderCreateDialog: Story = {
  name: "Custom Provider — create dialog",
  render: () => (
    <StoryProviders>
      <CustomProviderDialogMount />
    </StoryProviders>
  ),
}

export const CustomProviderEditDialog: Story = {
  name: "Custom Provider — edit dialog",
  render: () => (
    <StoryProviders>
      <CustomProviderDialogMount
        existing={{
          providerID: "custom-ollama",
          name: "Local Ollama",
          config: {
            npm: "@ai-sdk/openai-compatible",
            options: { baseURL: "http://localhost:11434/v1" },
            models: {
              "qwen2.5-coder:32b": {
                name: "Qwen 2.5 Coder 32B",
                reasoning: true,
                modalities: { input: ["text", "image"] },
              },
              "llama3.3:70b": { name: "Llama 3.3 70B", reasoning: false },
            },
          },
        }}
      />
    </StoryProviders>
  ),
}
