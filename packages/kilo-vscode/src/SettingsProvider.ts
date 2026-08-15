import { existsSync } from "fs"
import * as vscode from "vscode"
import type { Config, KiloClient } from "@kilocode/sdk/v2/client"
import { type KiloConnectionService, ServerStartupError } from "./services/cli-backend"
import { buildWebviewHtml, getWebviewFontSize, isCursorHost } from "./utils"
import { saveImage } from "./kilo-provider/save-image"
import {
  buildSettingPath,
  getConfigErrorDetails,
  getErrorMessage,
  indexProvidersById,
} from "./kilo-provider-utils"
import { openConfig } from "./kilo-provider/open-config"
import { fetchOpenAIModels, FetchModelsError } from "./shared/fetch-models"
import { configFeatures } from "./features"
import { fetchSnapshot } from "./kilo-provider/config-snapshot"
import {
  ConfigBindings,
  type ConfigBinding,
  type ConfigProject,
  type ConfigTarget,
} from "./kilo-provider/config-bindings"
import { watchFontSizeConfig } from "./kilo-provider/font-size"
import {
  buildAutocompleteSettingsMessage,
  validAutocompleteSetting,
  watchAutocompleteConfig,
} from "./services/autocomplete/settings"
import {
  buildActionContext,
  computeDefaultSelection,
  fetchProviderData,
  connectProvider as connectProviderAction,
  authorizeProviderOAuth as authorizeOAuthAction,
  completeProviderOAuth as completeOAuthAction,
  disconnectProvider as disconnectProviderAction,
  saveCustomProvider as saveCustomProviderAction,
  resolveStoredKey,
} from "./provider-actions"
import type { StoredProviderKey } from "./provider-actions"
import { canonicalizePath, projectIdFor, samePath } from "./agent-manager/project/paths"
import { registeredProjects } from "./indexing-consent"
import { resetReadNotifications, type NotificationsContext, type NotificationsMessage } from "./kilo-provider/notifications"
import { resolveProjectDirectory } from "./project-directory"

/**
 * Minimal settings-only webview provider.
 *
 * Phase 5 of the repository reduction removed the chat sidebar; the remaining
 * product webview is just the configuration page (Base URL / API Key / Model /
 * autocomplete / commit-message language / about). This provider serves that
 * page by handling only the settings-related messages the webview actually
 * sends — config read/write, provider connect/auth, autocomplete settings,
 * language, open-config, reload and reset — reusing the shared
 * `provider-actions.ts` write paths and `buildWebviewHtml` assembly instead of
 * the full KiloProvider. It replaces `KiloProvider` inside
 * `SettingsEditorProvider`.
 *
 * Deliberately NOT implemented here (removed or out of scope): chat sessions,
 * agents, permissions, MCP, memory, notifications feed, remote/cloud, indexing,
 * sandboxing, telemetry push and Kilo Gateway device login (no UI remains for
 * the auth code flow).
 */

interface SettingsProviderOptions {
  /** Explicit project directory for a standalone panel; `null` disables project scope. */
  projectDirectory?: string | null
  /** Standalone editor panels never show the legacy top bar. */
  hideTopBar?: boolean
}

type SettingsMessage = {
  type: string
  [key: string]: unknown
}

type ConfigSnapshot = {
  effective: Config
  targets: { global: ConfigTarget; project: ConfigTarget }
}

/** Incoming webview message handler. */
type MessageHandler = (message: SettingsMessage) => void | Promise<void>

export class SettingsProvider implements vscode.Disposable {
  private webview: vscode.Webview | null = null
  private connectionState: "connecting" | "connected" | "disconnected" | "error" = "connecting"
  private connectionGeneration = 0
  private isWebviewReady = false
  private readonly extensionVersion =
    vscode.extensions.getExtension("kilocode.kilo-code")?.packageJSON?.version ?? "unknown"
  private cachedProvidersMessage: unknown = null
  /** Provider API keys retained extension-side for authenticated model fetches (#10139). */
  private storedProviderKeys: Record<string, StoredProviderKey> = {}
  private providersRefresh: Promise<void> | null = null
  private providersQueued = false
  private providersGeneration = 0
  private cachedConfigMessage: unknown = null
  private cachedGlobalConfig: Config | null = null
  private cachedNotificationsMessage: NotificationsMessage | null = null
  private readonly configBindings = new ConfigBindings()
  /** Ref-count of in-flight handleUpdateConfig calls; prevents fetchAndSendConfig from sending stale data. */
  private pending = 0
  private projectDirectory: string | null | undefined
  private initConnectionPromise: Promise<void> | null = null
  private webviewMessageDisposable: vscode.Disposable | null = null
  private autocompleteConfigDisposable: vscode.Disposable | null = null
  private unsubscribeState: (() => void) | null = null
  private unsubscribeLanguageChange: (() => void) | null = null
  private unsubscribeModelSelectorExpanded: (() => void) | null = null
  private unsubscribeDirectoryProvider: (() => void) | null = null

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly connectionService: KiloConnectionService,
    private readonly extensionContext?: vscode.ExtensionContext,
    private readonly opts: SettingsProviderOptions = {},
  ) {
    this.projectDirectory = opts.projectDirectory
  }

  /** Shared SDK KiloClient or null when not yet connected. */
  private get client(): KiloClient | null {
    try {
      return this.connectionService.getClient()
    } catch {
      return null
    }
  }

  public postMessage(message: unknown): void {
    if (!this.webview) return
    void this.webview.postMessage(message).then(undefined, (error) => {
      console.error("[Kilo New] SettingsProvider: postMessage failed", error)
    })
  }

  private postConnectionState(error = this.connectionService.getConnectionError()): void {
    this.postMessage({
      type: "connectionState",
      state: this.connectionState,
      ...(this.connectionState === "error" && {
        error: getErrorMessage(error) || "Connection to CLI backend lost. Retry to reconnect.",
      }),
    })
  }

  /** Re-push ready + connection state after webview reload or SSE reconnect. */
  private async syncWebviewState(reason: string): Promise<void> {
    if (!this.isWebviewReady) return
    const serverInfo = this.connectionService.getServerInfo()
    this.postConnectionState()
    if (serverInfo) {
      const langConfig = vscode.workspace.getConfiguration("kilo-code.new")
      this.postMessage({
        type: "ready",
        serverInfo,
        extensionVersion: this.extensionVersion,
        vscodeLanguage: vscode.env.language,
        languageOverride: langConfig.get<string>("language"),
        fontSize: getWebviewFontSize(),
        workspaceDirectory: this.getProjectDirectory(),
      })
    }
    void reason
  }

  /** Resolve a WebviewPanel for the settings editor-area panel. */
  public resolveWebviewPanel(panel: vscode.WebviewPanel): void {
    this.isWebviewReady = false
    this.webview = panel.webview

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }

    panel.webview.html = this._getHtmlForWebview(panel.webview)
    this.setupWebviewMessageHandler(panel.webview)
    this.initializeConnection()
  }

  public setProjectDirectory(directory: string | null): void {
    if (this.projectDirectory === directory) return
    this.projectDirectory = directory
    this.configBindings.clear()
    this.cachedConfigMessage = null
    this.postMessage({ type: "workspaceDirectoryChanged", directory: directory ?? "" })
    this.postMessage({ type: "configBindingExpired", reason: "project-changed" })
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return buildWebviewHtml(webview, {
      scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js")),
      styleUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview.css")),
      iconsBaseUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "assets", "icons")),
      workerUri: webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "shiki-worker.js")),
      title: "Kilo Settings",
      port: this.connectionService.getServerInfo()?.port,
      extraStyles: `.container { height: 100vh; }`,
      // Standalone settings panels never show the bar (mirrors KiloProvider).
      topBar: this.opts.hideTopBar !== true && isCursorHost(),
    })
  }

  private setupWebviewMessageHandler(webview: vscode.Webview): void {
    this.webviewMessageDisposable?.dispose()
    this.autocompleteConfigDisposable?.dispose()
    // Push autocomplete settings whenever VS Code config changes.
    this.autocompleteConfigDisposable = watchAutocompleteConfig((msg) => this.postMessage(msg))

    this.webviewMessageDisposable = webview.onDidReceiveMessage((message) => {
      const handler = this.messageHandlers[message.type]
      if (handler) void handler(message)
    })
    this.webviewMessageDisposable = watchFontSizeConfig((msg) => this.postMessage(msg), this.webviewMessageDisposable)
  }

  /** Message dispatch table keyed by `message.type` — keeps onDidReceiveMessage complexity low. */
  private readonly messageHandlers: Record<string, MessageHandler> = {
    webviewReady: async () => {
      this.isWebviewReady = true
      await this.syncWebviewState("webviewReady")
    },
    requestModelSelectorExpanded: () => {
      const value = this.extensionContext?.globalState.get("modelSelectorExpanded", true) ?? true
      this.postMessage({ type: "modelSelectorExpandedLoaded", value })
    },
    persistModelSelectorExpanded: async (message) => {
      if (typeof message.value === "boolean") {
        await this.extensionContext?.globalState.update("modelSelectorExpanded", message.value)
        this.connectionService.notifyModelSelectorExpandedChanged(message.value)
      }
    },
    copyToClipboard: (message) => this.handleCopyToClipboard(message),
    requestConfig: () =>
      this.fetchAndSendConfig().catch((e) => console.error("[Kilo New] SettingsProvider: fetchAndSendConfig failed:", e)),
    requestGlobalConfig: () =>
      this.fetchAndSendGlobalConfig().catch((e) =>
        console.error("[Kilo New] SettingsProvider: fetchAndSendGlobalConfig failed:", e),
      ),
    requestAutocompleteSettings: () => this.postMessage(buildAutocompleteSettingsMessage()),
    updateConfig: (message) =>
      this.handleUpdateConfig(
        message.config as Partial<Config> | undefined,
        message.projectConfig as Partial<Config> | undefined,
        message.globalUnset as string[][] | undefined,
        message.projectUnset as string[][] | undefined,
        typeof message.globalBindingId === "string" ? message.globalBindingId : undefined,
        typeof message.projectBindingId === "string" ? message.projectBindingId : undefined,
      ),
    updateSetting: (message) => this.handleUpdateSetting(message.key as string, message.value),
    requestProviders: () =>
      this.fetchAndSendProviders().catch((e) =>
        console.error("[Kilo New] SettingsProvider: fetchAndSendProviders failed:", e),
      ),
    connectProvider: (message) => this.handleProviderAction(message),
    authorizeProviderOAuth: (message) => this.handleProviderAction(message),
    completeProviderOAuth: (message) => this.handleProviderAction(message),
    disconnectProvider: (message) => this.handleProviderAction(message),
    saveCustomProvider: (message) => this.handleProviderAction(message),
    fetchCustomProviderModels: (message) =>
      this.handleFetchCustomProviderModels(message).catch((e) =>
        console.error("[Kilo New] SettingsProvider: fetchCustomProviderModels failed:", e),
      ),
    setLanguage: async (message) => {
      await vscode.workspace
        .getConfiguration("kilo-code.new")
        .update("language", message.locale || undefined, vscode.ConfigurationTarget.Global)
      this.connectionService.notifyLanguageChanged(message.locale as string)
    },
    openConfigFile: (message) =>
      openConfig(
        message.scope as "global" | "local",
        message.labels as Parameters<typeof openConfig>[1],
        this.getProjectDirectory(),
      ),
    saveImage: (message) =>
      saveImage(this.getWorkspaceDirectory(), message as unknown as { dataUrl: string; filename: string }),
    reload: () => this.handleReload().catch((e) => console.error("[Kilo New] SettingsProvider: Reload failed:", e)),
    openVSCodeSettings: (message) => {
      vscode.commands.executeCommand("workbench.action.openSettings", message.query)
    },
    resetAllSettings: () => this.handleResetAllSettings(),
    resetReadNotifications: () => resetReadNotifications(this.notificationsContext()),
    openExternal: (message) => {
      if (typeof message.url === "string") void vscode.env.openExternal(vscode.Uri.parse(message.url))
    },
  }

  private async handleCopyToClipboard(message: SettingsMessage): Promise<void> {
    if (typeof message.id !== "string" || typeof message.text !== "string") return
    await vscode.env.clipboard.writeText(message.text).then(
      () => this.postMessage({ type: "clipboardWriteResult", id: message.id, ok: true }),
      (err) =>
        this.postMessage({
          type: "clipboardWriteResult",
          id: message.id,
          ok: false,
          error: getErrorMessage(err),
        }),
    )
  }

  private initializeConnection(): Promise<void> {
    if (this.initConnectionPromise) return this.initConnectionPromise
    this.initConnectionPromise = this.doInitializeConnection().finally(() => {
      this.initConnectionPromise = null
    })
    return this.initConnectionPromise
  }

  private async doInitializeConnection(): Promise<void> {
    this.connectionState = "connecting"
    this.connectionGeneration++
    this.configBindings.clear()
    this.postMessage({ type: "connectionState", state: "connecting" })

    this.unsubscribeState?.()
    this.unsubscribeLanguageChange?.()
    this.unsubscribeModelSelectorExpanded?.()
    this.unsubscribeDirectoryProvider?.()

    try {
      await this.connectionService.connect(this.settingsDirectory())

      // Push connection state to the webview and refresh server-side data on
      // (re)connect. The settings page has no sessions, so no SSE filtering.
      this.unsubscribeState = this.connectionService.onStateChange(async (state) => {
        if (this.connectionState !== state) {
          this.connectionGeneration++
          this.configBindings.clear()
        }
        this.connectionState = state
        this.postConnectionState()
        if (state === "connected") {
          try {
            await this.syncWebviewState("sse-connected")
          } catch (error) {
            console.error("[Kilo New] SettingsProvider: failed to sync after connecting:", error)
          }
        }
      })

      // Propagate language changes made in other webviews to this panel.
      this.unsubscribeLanguageChange = this.connectionService.onLanguageChanged((locale) => {
        this.postMessage({ type: "languageChanged", locale })
      })

      // Propagate model-selector expand/collapse made elsewhere.
      this.unsubscribeModelSelectorExpanded = this.connectionService.onModelSelectorExpandedChanged((value) => {
        this.postMessage({ type: "modelSelectorExpandedLoaded", value })
      })

      // Register this panel's directory so drainPendingPrompts() covers it.
      this.unsubscribeDirectoryProvider = this.connectionService.registerDirectoryProvider(() => {
        return [this.getWorkspaceDirectory()]
      })

      const serverInfo = this.connectionService.getServerInfo()
      this.connectionState = this.connectionService.getConnectionState()

      if (serverInfo) {
        const langConfig = vscode.workspace.getConfiguration("kilo-code.new")
        this.postMessage({
          type: "ready",
          serverInfo,
          extensionVersion: this.extensionVersion,
          vscodeLanguage: vscode.env.language,
          languageOverride: langConfig.get<string>("language"),
          fontSize: getWebviewFontSize(),
          workspaceDirectory: this.getProjectDirectory(),
        })
      }
      this.postConnectionState()

      await this.syncWebviewState("initializeConnection")

      // Fetch providers + config in parallel; the webview retries via
      // extensionDataReady if the backend was not ready on first request.
      await Promise.all([this.fetchAndSendProviders(), this.fetchAndSendConfig()])
      this.postMessage({ type: "extensionDataReady" })
    } catch (error) {
      console.error("[Kilo New] SettingsProvider: failed to initialize connection:", error)
      this.connectionState = "error"
      this.postMessage({
        type: "connectionState",
        state: "error",
        error: getErrorMessage(error) || "Failed to connect to CLI backend",
        ...(error instanceof ServerStartupError && {
          userMessage: error.userMessage,
          userDetails: error.userDetails,
        }),
      })
    }
  }

  // ── Providers ──────────────────────────────────────────────────────────────

  private async fetchAndSendProviders(): Promise<void> {
    const next = ++this.providersGeneration
    if (this.providersRefresh) {
      this.providersQueued = true
      await this.providersRefresh
      return
    }
    const task = (async () => {
      let generation = next
      while (true) {
        this.providersQueued = false
        const client = this.client
        if (!client) {
          if (this.cachedProvidersMessage && generation === this.providersGeneration)
            this.postMessage(this.cachedProvidersMessage)
          return
        }
        try {
          const { response, authMethods, authStates, storedKeys } = await fetchProviderData(
            client,
            this.getWorkspaceDirectory(),
          )
          if (generation !== this.providersGeneration || client !== this.client) {
            if (!this.providersQueued) return
            generation = this.providersGeneration
            continue
          }
          this.storedProviderKeys = storedKeys
          const settings = vscode.workspace.getConfiguration("kilo-code.new.model")
          const message = {
            type: "providersLoaded",
            providers: indexProvidersById(response.all),
            connected: response.connected,
            defaults: response.default,
            defaultSelection: computeDefaultSelection(
              this.cachedConfigMessage as { config?: { model?: string } } | null,
              settings.get<string>("providerID", ""),
              settings.get<string>("modelID", ""),
            ),
            authMethods,
            authStates,
          }
          this.cachedProvidersMessage = message
          this.postMessage(message)
        } catch (error) {
          if (generation !== this.providersGeneration) {
            if (!this.providersQueued) return
            generation = this.providersGeneration
            continue
          }
          console.error("[Kilo New] SettingsProvider: Failed to fetch providers:", error)
        }
        if (!this.providersQueued) return
        generation = this.providersGeneration
      }
    })()
    const done = task.finally(() => {
      if (this.providersRefresh === done) this.providersRefresh = null
    })
    this.providersRefresh = done
    await done
  }

  private async handleProviderAction(msg: SettingsMessage): Promise<void> {
    const rid = typeof msg.requestId === "string" ? msg.requestId : ""
    const pid = typeof msg.providerID === "string" ? msg.providerID : ""
    if (!rid || !pid) return
    if (!this.client) {
      this.postProviderNotConnected(rid, pid, msg.type)
      return
    }
    const ctx = buildActionContext(
      this.client,
      (m) => this.postMessage(m),
      getErrorMessage,
      this.getWorkspaceDirectory(),
      () => this.fetchAndSendProviders(),
    )
    const set = (m: unknown) => {
      this.cachedConfigMessage = m
      if (m && typeof m === "object" && "globalConfig" in m)
        this.cachedGlobalConfig = (m as { globalConfig?: Config }).globalConfig ?? null
    }
    const method = typeof msg.method === "number" ? msg.method : 0
    const key = typeof msg.apiKey === "string" ? msg.apiKey : undefined
    const keyChanged = msg.apiKeyChanged === true
    const code = typeof msg.code === "string" ? msg.code : undefined
    const config = msg.config && typeof msg.config === "object" ? (msg.config as Record<string, unknown>) : undefined
    const metadata =
      msg.metadata && typeof msg.metadata === "object" ? (msg.metadata as Record<string, unknown>) : undefined
    if (msg.type === "connectProvider" && key) return connectProviderAction(ctx, rid, pid, key, metadata)
    if (msg.type === "authorizeProviderOAuth") return authorizeOAuthAction(ctx, rid, pid, method)
    if (msg.type === "completeProviderOAuth") return completeOAuthAction(ctx, rid, pid, method, code)
    if (msg.type === "disconnectProvider") return disconnectProviderAction(ctx, rid, pid, this.cachedConfigMessage, set)
    if (msg.type === "saveCustomProvider" && config)
      return saveCustomProviderAction(ctx, rid, pid, config, key, keyChanged, this.cachedConfigMessage, set)
  }

  private postProviderNotConnected(rid: string, pid: string, type: string): void {
    const action =
      type === "disconnectProvider" ? "disconnect" : type === "authorizeProviderOAuth" ? "authorize" : "connect"
    this.postMessage({
      type: "providerActionError",
      requestId: rid,
      providerID: pid,
      action,
      message: "Not connected to CLI backend",
    })
  }

  private async handleFetchCustomProviderModels(msg: SettingsMessage): Promise<void> {
    const rid = typeof msg.requestId === "string" ? msg.requestId : ""
    const url = typeof msg.baseURL === "string" ? msg.baseURL : ""
    if (!rid || !url) return
    const key =
      typeof msg.apiKey === "string" ? msg.apiKey : resolveStoredKey(this.storedProviderKeys, msg.providerID, url)
    const headers = msg.headers && typeof msg.headers === "object" ? (msg.headers as Record<string, string>) : undefined
    try {
      const models = await fetchOpenAIModels({ baseURL: url, apiKey: key, headers })
      this.postMessage({ type: "customProviderModelsFetched", requestId: rid, models })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch models"
      const auth = err instanceof FetchModelsError && err.auth
      this.postMessage({ type: "customProviderModelsFetched", requestId: rid, error: message, auth })
    }
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  private async fetchAndSendConfig(): Promise<void> {
    if (!this.client || this.connectionState !== "connected") {
      if (this.cachedConfigMessage) this.postMessage(this.cachedConfigMessage)
      return
    }
    // Skip if handleUpdateConfig is in flight — a configLoaded sent now would
    // race with the write and potentially overwrite optimistic webview state.
    if (this.pending > 0) return
    try {
      await this.refreshConfig("configLoaded")
    } catch (error) {
      console.error("[Kilo New] SettingsProvider: Failed to fetch config:", error)
    }
  }

  private async fetchAndSendGlobalConfig(): Promise<void> {
    if (!this.client || this.connectionState !== "connected") return
    try {
      const { data: config } = await this.client.global.config.get({ throwOnError: true })
      this.cachedGlobalConfig = config ?? null
      this.postMessage({ type: "globalConfigLoaded", config })
    } catch (error) {
      console.error("[Kilo New] SettingsProvider: Failed to fetch global config:", error)
    }
  }

  private async refreshConfig(type: "configLoaded" | "configUpdated", dir = this.settingsDirectory()) {
    const snapshot = await fetchSnapshot(this.client!, dir, () => this.configSettings())
    const bindings = this.bindingsFor(dir, snapshot.targets)
    const globalConfig = (snapshot.targets?.global.raw ?? snapshot.globalConfig) as Config
    const projectConfig = bindings.project ? (snapshot.targets?.project.raw as Config) : undefined
    this.cachedGlobalConfig = globalConfig ?? null
    this.cachedConfigMessage = {
      type: "configLoaded",
      config: snapshot.config,
      globalConfig,
      projectConfig,
      bindings,
      collections: snapshot.collections,
      settings: snapshot.settings,
      features: snapshot.features,
    }
    this.postMessage({
      type,
      config: snapshot.config,
      globalConfig,
      projectConfig,
      bindings,
      collections: snapshot.collections,
      settings: snapshot.settings,
      features: snapshot.features,
    })
  }

  private async handleUpdateConfig(
    partial: Partial<Config> = {},
    project: Partial<Config> = {},
    globalUnset: string[][] = [],
    projectUnset: string[][] = [],
    globalBindingId?: string,
    projectBindingId?: string,
  ): Promise<void> {
    if (!this.client || this.connectionState !== "connected") {
      this.postMessage({ type: "configUpdateFailed", message: "Not connected to CLI backend" })
      return
    }

    const refreshProviders = this.refreshProvidersAfterConfig(partial)
    const hasGlobal = Object.keys(partial).length > 0 || globalUnset.length > 0
    const hasProject = Object.keys(project).length > 0 || projectUnset.length > 0
    if (!hasGlobal && !hasProject) return

    const globalBinding = this.resolveBinding(hasGlobal, globalBindingId)
    const projectBinding = this.resolveBinding(hasProject, projectBindingId)
    if (this.missingBinding(hasGlobal, globalBinding, hasProject, projectBinding)) {
      this.postMessage({ type: "configUpdateFailed", message: "Settings changed or expired. Reload before saving." })
      return
    }

    this.pending++
    const dir = projectBinding?.directory ?? globalBinding?.directory ?? this.settingsDirectory()
    const completed: Array<"global" | "project"> = []
    let snapshot: ConfigSnapshot | undefined

    try {
      snapshot = await this.applyConfigOverlays(
        hasGlobal,
        partial,
        globalUnset,
        globalBinding,
        hasProject,
        project,
        projectUnset,
        projectBinding,
        completed,
      )
      this.consumeBindings(globalBinding, projectBinding)
    } catch (error) {
      if (completed.length > 0) this.consumeBindings(globalBinding, projectBinding)
      this.postConfigFailure(error, completed, snapshot, dir)
      this.pending--
      return
    }
    try {
      await this.broadcastConfigUpdated(snapshot, dir, refreshProviders)
    } catch (error) {
      this.postConfigFailure(error, completed, snapshot, dir)
    } finally {
      this.pending--
    }
  }

  /** True when the config patch touches provider/model fields that need a provider refresh. */
  private refreshProvidersAfterConfig(partial: Partial<Config>): boolean {
    return (
      partial.provider !== undefined ||
      partial.disabled_providers !== undefined ||
      partial.enabled_providers !== undefined ||
      partial.hide_prompt_training_models !== undefined
    )
  }

  private resolveBinding(has: boolean, bindingId?: string): ConfigBinding | undefined {
    if (!has) return undefined
    return this.configBindings.get(bindingId, this.connectionGeneration, (project) => this.validConfigProject(project))
  }

  private missingBinding(
    hasGlobal: boolean,
    globalBinding: ConfigBinding | undefined,
    hasProject: boolean,
    projectBinding: ConfigBinding | undefined,
  ): boolean {
    return (hasGlobal && !globalBinding) || (hasProject && !projectBinding)
  }

  private consumeBindings(globalBinding: ConfigBinding | undefined, projectBinding: ConfigBinding | undefined): void {
    if (globalBinding) this.configBindings.consume(globalBinding.id)
    if (projectBinding) this.configBindings.consume(projectBinding.id)
  }

  /** Applies the global/project overlay updates, recording completed scopes into `completed`. */
  private async applyConfigOverlays(
    hasGlobal: boolean,
    partial: Partial<Config>,
    globalUnset: string[][],
    globalBinding: ConfigBinding | undefined,
    hasProject: boolean,
    project: Partial<Config>,
    projectUnset: string[][],
    projectBinding: ConfigBinding | undefined,
    completed: Array<"global" | "project">,
  ): Promise<ConfigSnapshot> {
    await this.connectionService.drainPendingPrompts()
    let snapshot: ConfigSnapshot | undefined
    if (hasGlobal) {
      const result = await this.client!.config.overlayUpdate(
        {
          scope: "global",
          set: partial,
          unset: globalUnset,
          directory: globalBinding!.directory,
          expected: {
            path: globalBinding!.target.path,
            revision: globalBinding!.target.revision,
          },
        },
        { throwOnError: true },
      )
      snapshot = result.data as ConfigSnapshot
      completed.push("global")
    }
    if (hasProject) {
      const result = await this.client!.config.overlayUpdate(
        {
          scope: "project",
          set: project,
          unset: projectUnset,
          directory: projectBinding!.directory,
          expected: {
            path: projectBinding!.target.path,
            revision: projectBinding!.target.revision,
          },
        },
        { throwOnError: true },
      )
      snapshot = result.data as ConfigSnapshot
      completed.push("project")
    }
    return snapshot!
  }

  private async broadcastConfigUpdated(
    snapshot: ConfigSnapshot | undefined,
    dir: string,
    refreshProviders: boolean,
  ): Promise<void> {
    if (!snapshot) throw new Error("Config update returned no authoritative snapshot")
    const bindings = this.bindingsFor(dir, snapshot.targets)
    const global = snapshot.targets.global.raw as Config
    const projectConfig = bindings.project ? (snapshot.targets.project.raw as Config) : undefined
    this.cachedGlobalConfig = global
    this.cachedConfigMessage = {
      type: "configLoaded",
      config: snapshot.effective,
      globalConfig: global,
      projectConfig,
      bindings,
      settings: this.configSettings(),
      features: configFeatures(snapshot.effective),
    }
    this.postMessage({
      type: "configUpdated",
      config: snapshot.effective,
      globalConfig: global,
      projectConfig,
      bindings,
      settings: this.configSettings(),
      features: configFeatures(snapshot.effective),
    })
    if (refreshProviders) {
      await this.fetchAndSendProviders().catch((error) =>
        console.error("[Kilo New] SettingsProvider: Post-config provider refresh failed:", error),
      )
    }
  }

  private postConfigFailure(
    error: unknown,
    completed: Array<"global" | "project"> = [],
    snapshot?: ConfigSnapshot,
    directory?: string,
  ): void {
    console.error("[Kilo New] SettingsProvider: Failed to update config:", error)
    const bindings = snapshot && directory ? this.bindingsFor(directory, snapshot.targets) : undefined
    this.postMessage({
      type: "configUpdateFailed",
      message: getErrorMessage(error) || "Failed to update config",
      details: getConfigErrorDetails(error),
      completedScopes: completed,
      config: snapshot?.effective,
      globalConfig: snapshot?.targets.global.raw,
      projectConfig: bindings?.project ? snapshot?.targets.project.raw : undefined,
      bindings,
    })
  }

  private configSettings() {
    return {
      maxCost: vscode.workspace.getConfiguration("kilo-code.new").get<number>("maxCost", 0),
      languageCommitMessage: vscode.workspace.getConfiguration("kilo-code.new").get<string>("languageCommitMessage", "sync"),
    }
  }

  private settingsDirectory(): string {
    return this.projectDirectory ?? this.getRootDirectory()
  }

  private bindingsFor(
    directory: string,
    targets:
      | {
          global: ConfigTarget
          project: ConfigTarget
        }
      | undefined,
  ): { global?: ConfigBinding; project?: ConfigBinding } {
    if (!targets) return {}
    const project = this.configProject(directory)
    return {
      global: this.configBindings.create({
        connection: this.connectionGeneration,
        scope: "global",
        directory,
        target: { ...targets.global, raw: { ...targets.global.raw } },
      }),
      project: project
        ? this.configBindings.create({
            connection: this.connectionGeneration,
            scope: "project",
            directory: project.root,
            target: { ...targets.project, raw: { ...targets.project.raw } },
            project,
          })
        : undefined,
    }
  }

  private configProject(directory: string): ConfigProject | undefined {
    const root = canonicalizePath(directory)
    const pinned = canonicalizePath(this.getRootDirectory())
    if (samePath(root, pinned)) {
      return { id: projectIdFor(root), root, generation: 0, pinned: true }
    }
    if (!this.extensionContext) return undefined
    const project = registeredProjects(this.extensionContext).find((item) => samePath(item.root, root))
    if (!project?.trusted || !existsSync(project.root)) return undefined
    return { id: project.id, root: project.root, generation: 0, pinned: false }
  }

  private validConfigProject(project: ConfigProject): boolean {
    if (project.pinned) {
      return samePath(project.root, canonicalizePath(this.getRootDirectory())) && existsSync(project.root)
    }
    if (!this.extensionContext) return false
    const current = registeredProjects(this.extensionContext).find((item) => item.id === project.id)
    return !!current?.trusted && samePath(current.root, project.root) && existsSync(current.root)
  }

  // ── Direct VS Code settings ────────────────────────────────────────────────

  private async handleUpdateSetting(key: string, value: unknown): Promise<void> {
    const { section, leaf } = buildSettingPath(key)
    if (section === "autocomplete" && !validAutocompleteSetting(leaf, value)) return
    const config = vscode.workspace.getConfiguration(`kilo-code.new${section ? `.${section}` : ""}`)
    // Normalize a webview-side clear to `undefined` so VS Code removes the
    // key from settings.json rather than persisting a literal `null`.
    const next = value === null ? undefined : value
    await config.update(leaf, next, vscode.ConfigurationTarget.Global)
  }

  private async handleReload(): Promise<void> {
    if (!this.client) {
      console.warn("[Kilo New] SettingsProvider: handleReload: no client connection")
      return
    }
    const dir = this.getWorkspaceDirectory()
    try {
      await this.client.instance.reload({ directory: dir }, { throwOnError: true })
    } catch (err) {
      const cause = err instanceof Error ? err.cause : undefined
      const status =
        cause && typeof cause === "object" && "status" in cause ? (cause as { status?: number }).status : undefined
      if (status === 409) {
        vscode.window.showWarningMessage(
          "Cannot reload while a session is running. Wait for it to finish or abort it first.",
        )
        return
      }
      console.error("[Kilo New] SettingsProvider: reload endpoint failed:", err)
      const detail = err instanceof Error && err.message ? err.message : "See extension logs for details."
      vscode.window.showErrorMessage(`Reload failed. ${detail}`)
      return
    }
    // Re-fetch server-side state after a reload so the UI reflects disk config.
    await Promise.all([this.fetchAndSendConfig(), this.fetchAndSendProviders()]).catch((error) =>
      console.error("[Kilo New] SettingsProvider: Post-reload refresh failed:", error),
    )
  }

  private async handleResetAllSettings(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      "Reset all Kilo Code extension settings to defaults?",
      { modal: true },
      "Reset",
    )
    if (confirmed !== "Reset") return

    const prefix = "kilo-code.new."
    const ext = vscode.extensions.getExtension("kilocode.kilo-code")
    const properties = ext?.packageJSON?.contributes?.configuration?.properties as Record<string, unknown> | undefined
    if (!properties) return

    for (const key of Object.keys(properties)) {
      if (!key.startsWith(prefix)) continue
      const parts = key.split(".")
      const section = parts.slice(0, -1).join(".")
      const leaf = parts[parts.length - 1]!
      const config = vscode.workspace.getConfiguration(section)
      await config.update(leaf, undefined, vscode.ConfigurationTarget.Global)
    }

    // Clear globalState entries that are not part of the configuration.
    await this.extensionContext?.globalState.update("modelSelectorExpanded", undefined)
    await this.extensionContext?.globalState.update("kilo.dismissedNotificationIds", undefined)

    // Re-send settings to the webview so the UI reflects the reset.
    this.postMessage(buildAutocompleteSettingsMessage())
    await this.fetchAndSendConfig()

    vscode.window.showInformationMessage("Kilo Code settings have been reset to defaults.")
  }

  private notificationsContext(): NotificationsContext {
    return {
      context: this.extensionContext,
      client: this.client,
      cached: () => this.cachedNotificationsMessage,
      set: (message) => {
        this.cachedNotificationsMessage = message
      },
      post: (message) => this.postMessage(message),
      notify: (id) => this.connectionService.notifyNotificationDismissed(id),
    }
  }

  // ── Directory resolution ───────────────────────────────────────────────────

  private getWorkspaceDirectory(): string {
    return this.getRootDirectory()
  }

  private getRootDirectory(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0]!.uri.fsPath
    }
    return process.cwd()
  }

  private getProjectDirectory(): string | undefined {
    return resolveProjectDirectory(this.projectDirectory, () => this.getWorkspaceDirectory())
  }

  dispose(): void {
    this.unsubscribeState?.()
    this.unsubscribeLanguageChange?.()
    this.unsubscribeModelSelectorExpanded?.()
    this.unsubscribeDirectoryProvider?.()
    this.webviewMessageDisposable?.dispose()
    this.autocompleteConfigDisposable?.dispose()
    this.isWebviewReady = false
    this.webview = null
  }
}
