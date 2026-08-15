/** @jsxImportSource solid-js */
/**
 * StoryProviders — wraps stories with the contexts needed by the settings
 * webview. The chat/session layer was removed in Phase 5 (repository
 * reduction), so this no longer mocks Session/Feedback/Notifications/etc.
 *
 * Where a real provider is safe to instantiate without an extension host
 * (VSCodeProvider, ServerProvider, DisplayProvider), we use the real thing so
 * components that call useVSCode()/useServer()/useProvider()/useConfig() don't
 * throw. Provider and Config are mocked so model lists and config edits are
 * synchronous.
 */

import { createSignal, createMemo, type ParentComponent } from "solid-js"
import { VSCodeProvider } from "../context/vscode"
import { ServerProvider } from "../context/server"
import { ProviderContext } from "../context/provider"
import { flattenModels, findModel as _findModel } from "../context/provider-utils"
import { ConfigProvider, ConfigContext } from "../context/config"
import { DisplayProvider } from "../context/display"
import { DataProvider, type OpenDiffFn, type OpenFileFn } from "@kilocode/kilo-ui/context/data"
import { DiffComponentProvider } from "@kilocode/kilo-ui/context/diff"
import { CodeComponentProvider } from "@kilocode/kilo-ui/context/code"
import { FileComponentProvider } from "@kilocode/kilo-ui/context/file"
import { DialogProvider } from "@kilocode/kilo-ui/context/dialog"
import { MarkedProvider } from "@kilocode/kilo-ui/context/marked"
import { I18nProvider, pluralCategory, pluralKey } from "@kilocode/kilo-ui/context"
import type { UiI18nPluralKey } from "@kilocode/kilo-ui/context"
import { Diff } from "@kilocode/kilo-ui/diff"
import { Code } from "@kilocode/kilo-ui/code"
import { File } from "@kilocode/kilo-ui/file"
import { LanguageContext } from "../context/language"
import { dict as uiEn } from "@kilocode/kilo-ui/i18n/en"
import { dict as appEn } from "../i18n/en"
import { dict as kiloEn } from "@kilocode/kilo-i18n/en"
import { hasIndexingPlugin } from "@kilocode/kilo-indexing/detect"
import { resolveTemplate } from "../context/language-utils"
import type { Config, FeatureFlags, ProviderAuthState } from "../types/messages"

type PluginSpec = string | [string, Record<string, unknown>]

// Merged English dictionary (same merge order as the real LanguageProvider)
const dict: Record<string, string> = { ...appEn, ...uiEn, ...kiloEn }

/** Story-local translator. Usable outside the provider tree, unlike useLanguage. */
export function t(key: string, params?: Record<string, string | number | boolean | undefined>) {
  return resolveTemplate(dict[key] ?? key, params)
}

const plural = (key: UiI18nPluralKey, count: number, params?: Record<string, string | number | boolean>) =>
  t(pluralKey(key, pluralCategory("en", count)), { ...params, count })

// ---------------------------------------------------------------------------
// Mock providers — pre-loaded Kilo Gateway model for stories
// ---------------------------------------------------------------------------

const MOCK_PROVIDERS = {
  kilo: {
    id: "kilo",
    name: "Kilo",
    env: [] as string[],
    models: {
      "anthropic/claude-sonnet-4-6": {
        id: "anthropic/claude-sonnet-4-6",
        name: "Anthropic: Claude Sonnet 4.6",
        inputPrice: 0.003,
        outputPrice: 0.015,
        limit: { context: 200000, output: 8192 },
        variants: {
          low: { reasoningEffort: "low" },
          medium: { reasoningEffort: "medium" },
          high: { reasoningEffort: "high" },
        },
      },
    },
  },
}

const MOCK_MODELS = flattenModels(MOCK_PROVIDERS as any)

/** A synchronous mock ProviderContext — provides models without waiting for a postMessage round-trip. */
const MockProviderProvider: ParentComponent<{ kiloAuth?: boolean; training?: boolean }> = (props) => {
  const models = createMemo(() =>
    MOCK_MODELS.map((model) => ({
      ...model,
      mayTrainOnYourPrompts: props.training === true,
    })),
  )
  const value = {
    providers: () => MOCK_PROVIDERS as any,
    connected: () => ["kilo"],
    defaults: () => ({}),
    defaultSelection: () => ({ providerID: "kilo", modelID: "anthropic/claude-sonnet-4-6" }),
    models,
    findModel: (sel: any) => _findModel(models(), sel),
    authMethods: () => ({}),
    authStates: () => (props.kiloAuth ? { kilo: "oauth" } : {}) as Record<string, ProviderAuthState>,
    isModelValid: () => true,
  }
  return <ProviderContext.Provider value={value}>{props.children}</ProviderContext.Provider>
}

function noop() {}

// ---------------------------------------------------------------------------
// StoryProviders component
// ---------------------------------------------------------------------------

interface StoryProvidersProps {
  /** When provided, injects a mock ConfigContext with this config instead of the real ConfigProvider. */
  config?: Config
  features?: Partial<FeatureFlags>
  globalConfig?: Config
  projectConfig?: Config
  onConfigChange?: (config: Config) => void
  onGlobalConfigChange?: (config: Config) => void
  onProjectConfigChange?: (config: Config) => void
  onOpenDiff?: OpenDiffFn
  onOpenFile?: OpenFileFn
  kiloAuth?: boolean
  training?: boolean
  /** When true, renders children without the default 12px padding wrapper */
  noPadding?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function merge(target: Record<string, unknown>, source: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...target }
  for (const [key, value] of Object.entries(source)) {
    const prev = result[key]
    if (isRecord(value) && isRecord(prev)) {
      result[key] = merge(prev, value)
      continue
    }
    result[key] = value
  }
  return result
}

/** Wraps children with either a mock ConfigContext (when config prop is given) or the real ConfigProvider. */
const ConfigWrapper: ParentComponent<{
  config?: Config
  features?: Partial<FeatureFlags>
  globalConfig?: Config
  projectConfig?: Config
  onConfigChange?: (config: Config) => void
  onGlobalConfigChange?: (config: Config) => void
  onProjectConfigChange?: (config: Config) => void
}> = (props) => {
  if (props.config) {
    const scoped = props.globalConfig !== undefined || props.projectConfig !== undefined
    const [cfg, setCfg] = createSignal(props.config)
    const [global, setGlobal] = createSignal(props.globalConfig ?? props.config)
    const [project, setProject] = createSignal(props.projectConfig ?? props.config)
    const [settings, setSettings] = createSignal<Record<string, unknown>>({})
    const [dirty, setDirty] = createSignal(false)
    const features = createMemo(() => {
      const config = cfg() as Config & {
        plugin?: readonly PluginSpec[] | null
      }

      return {
        indexing: props.features?.indexing ?? hasIndexingPlugin(config.plugin ?? []),
        sandboxControls: props.features?.sandboxControls ?? false,
      }
    })

    const value = {
      config: createMemo(() => cfg()),
      globalConfig: createMemo(() => (scoped ? global() : cfg())),
      globalDraft: () => ({}),
      projectConfig: createMemo(() => (scoped ? project() : cfg())),
      collections: () => ({}),
      settings,
      features,
      loading: () => false,
      isDirty: dirty,
      saving: () => false,
      saveError: () => null,
      updateConfig: (partial: Partial<Config>) => {
        setCfg((prev) => {
          const next = merge(prev as Record<string, unknown>, partial as Record<string, unknown>) as Config
          props.onConfigChange?.(next)
          return next
        })
        setDirty(true)
      },
      updateGlobalConfig: (partial: Partial<Config>) => {
        const update = (prev: Config) => {
          const next = merge(prev as Record<string, unknown>, partial as Record<string, unknown>) as Config
          props.onGlobalConfigChange?.(next)
          props.onConfigChange?.(next)
          return next
        }
        if (scoped) setGlobal(update)
        if (!scoped) setCfg(update)
        setDirty(true)
      },
      updateProjectConfig: (partial: Partial<Config>) => {
        const update = (prev: Config) => {
          const next = merge(prev as Record<string, unknown>, partial as Record<string, unknown>) as Config
          props.onProjectConfigChange?.(next)
          props.onConfigChange?.(next)
          return next
        }
        if (scoped) setProject(update)
        if (!scoped) setCfg(update)
        setDirty(true)
      },
      updateSetting: (key: string, value: unknown) => {
        setSettings((prev) => ({ ...prev, [key]: value }))
        setDirty(true)
      },
      applySetting: (key: string, value: unknown, _writeKey?: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }))
      },
      saveConfig: () => setDirty(false),
      discardConfig: () => setDirty(false),
    }
    return <ConfigContext.Provider value={value}>{props.children}</ConfigContext.Provider>
  }
  return <ConfigProvider>{props.children}</ConfigProvider>
}

export const StoryProviders: ParentComponent<StoryProvidersProps> = (props) => {
  const [locale] = createSignal<"en">("en")

  return (
    <VSCodeProvider>
      <ServerProvider>
        <ConfigWrapper
          config={props.config}
          features={props.features}
          globalConfig={props.globalConfig}
          projectConfig={props.projectConfig}
          onConfigChange={props.onConfigChange}
          onGlobalConfigChange={props.onGlobalConfigChange}
          onProjectConfigChange={props.onProjectConfigChange}
        >
          <DisplayProvider>
            <MockProviderProvider kiloAuth={props.kiloAuth} training={props.training}>
              <DialogProvider>
                <LanguageContext.Provider
                  value={{
                    locale,
                    setLocale: noop,
                    userOverride: () => "" as any,
                    t,
                  }}
                >
                  <I18nProvider value={{ locale: () => "en", t, plural }}>
                    <DataProvider
                      data={{
                        session: [],
                        session_status: {},
                        session_diff: {},
                        message: {},
                        part: {},
                      }}
                      directory="/project/"
                      onOpenDiff={props.onOpenDiff}
                      onOpenFile={props.onOpenFile}
                    >
                      <DiffComponentProvider component={Diff}>
                        <CodeComponentProvider component={Code}>
                          <FileComponentProvider component={File}>
                            <MarkedProvider>
                              {props.noPadding ? (
                                props.children
                              ) : (
                                <div style={{ padding: "12px" }}>{props.children}</div>
                              )}
                            </MarkedProvider>
                          </FileComponentProvider>
                        </CodeComponentProvider>
                      </DiffComponentProvider>
                    </DataProvider>
                  </I18nProvider>
                </LanguageContext.Provider>
              </DialogProvider>
            </MockProviderProvider>
          </DisplayProvider>
        </ConfigWrapper>
      </ServerProvider>
    </VSCodeProvider>
  )
}
