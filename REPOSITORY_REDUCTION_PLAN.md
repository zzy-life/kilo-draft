# 仓库功能裁剪总计划

## 1. 裁剪目标

将当前 Kilo Code 仓库裁剪为一个轻量的 VS Code 扩展，最终只提供以下能力：

1. 配置一个 OpenAI 兼容接口的 Base URL。
2. 配置 API Key。
3. 配置模型名称。
4. 提供编辑器内代码补全。
5. 根据 Git 工作区变更生成提交信息。

目标产品不再提供 Agent 聊天、自动执行工具、多会话管理、云服务、账号体系、Marketplace、遥测以及其他模型提供商集成。

## 2. 最终产品边界

### 2.1 保留的用户功能

- OpenAI 兼容接口设置：Base URL、API Key、模型。
- 代码补全开关和必要的补全行为设置。
- 自动触发行内补全。
- 手动触发代码补全。
- 必要时保留 Next Edit；是否最终保留应在代码补全收缩阶段单独确认。
- 在 VS Code Source Control 中生成 Git 提交信息。
- Git 提交信息语言或自定义提示词等直接相关设置。

### 2.2 移除的用户功能

- KiloClaw。
- Marketplace。
- Agent Manager 和 worktree 管理。
- 普通 Agent 聊天、任务历史和会话管理界面。
- Agent 工具调用、自动审批和权限交互。
- Diff Viewer、Changes Review、Sub-agent Viewer。
- Browser Automation。
- MCP 管理。
- Notebook Agent 桥接。
- Remote Control、云会话和深链接模型切换。
- Kilo 账号、Profile、余额、团队和订阅。
- Kilo Gateway 和 OpenRouter 路由。
- PostHog、OpenTelemetry 等遥测。
- 多 Provider 和 500+ 模型选择界面。
- CLI TUI、`kilo run` 等最终产品不需要的交互入口。
- 文档站、Storybook、JetBrains 插件等非目标产品。

### 2.3 最终交互形态

建议最终不再保留 Kilo 侧栏聊天 Webview。扩展只提供：

- VS Code 原生设置页中的接口配置；或一个非常小的设置页。
- 编辑器中的行内补全。
- Source Control 标题栏中的“生成提交信息”按钮。
- 必要的状态栏状态和错误通知。

目标数据流：

```text
VS Code 设置
  ├─ Base URL
  ├─ API Key
  └─ Model
       │
       ▼
OpenAI 兼容客户端
  ├─ 代码补全
  └─ Git 提交信息生成
```

## 3. 当前必须保护的功能链路

裁剪过程中，以下链路在替代方案落地前不得破坏。

### 3.1 代码补全链路

扩展入口：

```text
packages/kilo-vscode/src/extension.ts
packages/kilo-vscode/src/services/autocomplete/
```

当前注册调用：

```ts
void registerAutocompleteProvider(context, connectionService)
```

代码补全目前依赖 `KiloConnectionService` 和 CLI 后端。因此，在建立新的 OpenAI 兼容调用路径之前，不能提前删除：

```text
packages/kilo-vscode/src/services/cli-backend/
packages/opencode/
packages/sdk/js/
```

### 3.2 Git 提交信息链路

扩展侧：

```text
packages/kilo-vscode/src/services/commit-message/
```

后端侧：

```text
packages/opencode/src/kilocode/commit-message/
packages/opencode/src/kilocode/server/httpapi/handlers/commit-message.ts
packages/opencode/src/kilocode/server/httpapi/groups/commit-message.ts
```

当前注册调用：

```ts
registerCommitMessageService(context, connectionService)
```

提交信息生成目前通过 SDK 调用 CLI HTTP 接口，并复用 CLI Provider 和 LLM 层。因此，Provider 和 CLI 后端应在后期收缩，而不是第一批删除。

### 3.3 设置链路

设置界面目前承载大量 Agent、Provider、账号和云功能。最终只保留：

- Base URL。
- API Key。
- Model。
- 代码补全开关和必要参数。
- Git 提交信息相关参数。

在新的最小设置入口完成前，不应直接删除现有设置入口。

## 4. 裁剪原则

1. **先删独立叶子功能，再拆共享基础设施。**
2. **每阶段只处理一个边界清楚的功能组。**
3. **先删除用户入口和运行时接线，再删除实现目录。**
4. **共享资源必须确认无其他引用后再删除。**
5. **不在删除阶段顺带重构保留功能。**
6. **在新 OpenAI 调用链落地前，暂时保留旧 CLI 后端。**
7. **每阶段均由用户人工确认代码补全和提交信息功能。**
8. **用户现有未提交修改不得覆盖、回退或混入无关删除。**
9. **最终按实际依赖删除 workspace 包，而不是根据包名猜测用途。**
10. **文档、测试和构建配置随对应功能一起清理，避免长期残留。**

## 5. 推荐裁剪顺序

## 阶段 0：建立裁剪基线

### 目标

明确保留功能的当前行为，避免后续无法判断回归来自哪个阶段。

### 工作内容

- 记录当前 OpenAI 兼容 Provider 的配置方式和调用链。
- 记录代码补全使用的配置项、模型选择逻辑和后端接口。
- 记录 Git 提交信息按钮、命令、后端接口和默认模型选择逻辑。
- 列出扩展激活时注册的服务、命令、面板和后台连接。
- 为每个待删除模块记录入口、实现目录、构建入口、测试和共享依赖。

### 验收

- 可以明确指出代码补全和提交信息从扩展到模型请求的完整路径。
- 可以人工完成一次代码补全和一次提交信息生成。
- 明确现有配置文件或 SecretStorage 中的 API Key 存储位置。

### 说明

本阶段只调查和记录，不删除代码。

## 阶段 1：移除 KiloClaw

### 原因

KiloClaw 是独立的个人 AI 实例聊天面板，与代码补全和 Git 提交信息无关，具有独立 Provider、Webview 和构建入口，是风险最低的第一刀。

### 主要范围

删除：

```text
packages/kilo-vscode/src/kiloclaw/
packages/kilo-vscode/webview-ui/kiloclaw/
```

清理：

```text
packages/kilo-vscode/src/extension.ts
packages/kilo-vscode/package.json
packages/kilo-vscode/esbuild.js
packages/kilo-vscode/webview-ui/tsconfig.json
packages/kilo-vscode/knip.json
packages/kilo-vscode/tests/
```

### 验收

- KiloClaw 按钮、命令和恢复面板消失。
- 扩展不再连接 KiloClaw 相关远程服务。
- 代码补全仍可用。
- Git 提交信息生成仍可用。

## 阶段 2：移除 Marketplace

### 原因

Marketplace 是相对独立的展示、安装和通知功能，不属于目标产品。

### 主要范围

重点调查和移除：

```text
packages/kilo-vscode/src/MarketplacePanelProvider.ts
packages/kilo-vscode/src/services/marketplace/
packages/kilo-vscode/webview-ui/marketplace/
```

同时清理：

- Marketplace 命令和标题栏按钮。
- Webview 构建入口。
- 面板 Serializer。
- Workspace 匹配通知。
- Marketplace 专用消息类型、Context、资源和测试。

### 风险

Marketplace 安装流程可能与 Agent、模式、技能或 MCP 配置共享类型。只删除 Marketplace 自身入口和实现，不应在本阶段删除被其他功能复用的配置结构。

### 验收

- 不再出现 Marketplace 按钮、面板和通知。
- 扩展启动后不再查询 Marketplace。
- 两项保留功能正常。

## 阶段 3：移除 Agent Manager 和 worktree 管理

### 原因

Agent Manager 体积大，但目录边界较清晰。它依赖普通 Agent 会话、终端、Git、worktree、Diff 和共享 CLI 连接，因此应在简单叶子功能之后处理。

### 主要范围

重点删除：

```text
packages/kilo-vscode/src/agent-manager/
packages/kilo-vscode/webview-ui/agent-manager/
```

同步清理：

- Agent Manager 命令、快捷键和菜单。
- `terminal.integrated.commandsToSkipShell` 写入。
- 面板创建、恢复和关闭逻辑。
- worktree setup task definition。
- `.kilo/agent-manager.json` 相关状态。
- “Continue in Worktree”和“Create Worktree”桥接。
- Agent Manager 专用测试、脚本和构建入口。

### 风险

`extension.ts` 中很多逻辑同时向 Sidebar 和 Agent Manager 路由。删除时必须保留 Sidebar 或其他尚未裁剪模块所需的分支，不能整段删除共享命令。

### 验收

- 所有 Agent Manager 和 worktree 命令消失。
- 扩展不修改 Agent Manager 专用终端设置。
- 普通 Sidebar 暂时仍可打开。
- 两项保留功能正常。

## 阶段 4：移除独立 Agent 辅助能力

### 目标

删除围绕 Agent 聊天运行但不构成主聊天界面的外围功能。

### 建议拆成独立小批次

#### 4A：Browser Automation

重点范围：

```text
packages/kilo-vscode/src/services/browser-automation/
```

清理 Playwright MCP 注册、设置同步和重连恢复逻辑。

#### 4B：Notebook Bridge

重点范围：

```text
packages/kilo-vscode/src/services/notebook/
```

清理 Notebook 上下文收集、消息桥接和相关测试。

#### 4C：Remote Status 和云控制

重点范围：

```text
packages/kilo-vscode/src/services/RemoteStatusService.ts
```

清理状态栏、远程开关、客户端注入和云状态刷新。

#### 4D：Diff、Changes Review 和 Sub-agent Viewer

重点调查：

```text
packages/kilo-vscode/src/diff/
packages/kilo-vscode/src/DiffVirtualProvider.ts
packages/kilo-vscode/src/SubAgentViewerProvider.ts
packages/kilo-vscode/webview-ui/diff-viewer/
packages/kilo-vscode/webview-ui/diff-virtual/
```

删除前应确认代码补全不复用相关 diff 工具。Git 提交信息生成只读取 Git diff，不应依赖这些 Webview。

#### 4E：Attention、自动审批和 Agent Code Actions

重点调查：

```text
packages/kilo-vscode/src/services/attention/
packages/kilo-vscode/src/services/code-actions/
packages/kilo-vscode/src/commands/toggle-auto-approve.ts
```

注意不要误删代码补全自己的 CodeActionProvider。

### 当前进度（2026-08-14）

**阶段 4 已完成。SDK 生成物、i18n、配置与测试残留均已清理；仅剩人工验收（按用户指示不做构建验证）。**

已完成范围：

- `extension.ts` 中 Browser Automation、Notebook Bridge、Remote Status、独立 Diff/Sub-agent Viewer、Attention、Auto-Approve 和 Agent Code Actions 的激活/注册接线已移除。
- 已删除 Browser Automation、Attention、Notebook Bridge、Remote Status、独立 Diff/Virtual Diff、Sub-agent Viewer、Auto-Approve、Agent Code Actions 的扩展实现文件及部分专用测试；Browser Automation 配置、Auto-Approve 快捷键和独立 Diff Webview 构建入口同步移除。
- Webview 与扩展消息协议已移除 Browser、独立 Diff、Sub-agent Viewer、Auto-Approve、Remote 和通知设置相关消息；残留的失效调用、Auto-Approve Story 与独立 Diff 测试断言已清理。
- 为保留 Agent Manager 的 worktree diff，已将它依赖的最小二进制、图片和路径工具迁入 `src/agent-manager/diff-utils.ts`，未恢复独立 Diff Viewer。
- Notebook Bridge 的 HTTP 路由、服务、Host 工具、sandbox 接线与原生工具配置已移除；普通 `.ipynb` 内容读取能力继续保留。
- Remote Status 的 HTTP API、`/session/viewed` 路由、`KiloViewers` 注入和 presence 认证失效接线已移除。
- 已完整移除 Remote Control 的运行时栈：`src/kilo-sessions/`、云 presence 服务、`kilo remote` 命令、TUI Remote 指示器与 remote-exit 桥接、云通知/文件传送工具，以及对应 CLI、服务启动、工具注册、会话分享/同步钩子和专用测试。
- 已将通用会话分享恢复为既有 `ShareNext` 实现，避免继续通过已删除的 Kilo 云会话 relay。
- 已修复已知 Notebook 残留：通用工具注册表不再依赖已删除的 `Notebook.node`，相关 sandbox、权限和工具注册测试数据同步更新。
- 已通过 SDK 生成流程（重新运行 `bun ./script/generate.ts`，未手工改动生成文件）清除 Notebook、Remote 与 `session.viewed` 的客户端、类型、OpenAPI 定义与事件；同时从 `packages/core` 移除已失效的 `native_notebook_tools` 实验配置与 `notebook_read/edit/execute` 权限规则。
- 已清理各语言 i18n 中 Browser Automation、Attention/通知设置、Auto-Approve、独立 Diff、Show Changes、Sub-agent Viewer 和 Remote Control 文案（21 个语言文件均校验可正常加载），以及 Storybook、Knip、测试与配置残留。
- 已审查确认 Agent Manager worktree diff（`local-diff.ts`、`diff-utils.ts`）均为 Agent Manager 所需实现，无独立 Changes Review 残留；`packages/tui` 的 diff-viewer 插件为保留的 TUI 功能，不在裁剪范围。
- 已清除最后失效引用：`kilo-code.new.autoApprove.enabled` 死配置、TUI `session.viewed` presence 上报（`useSessionEffects`）、`cli/tui/worker.ts` 的 `remoteExit.shutdown()` 失效调用、`httpapi-exercise-scenarios.ts` 的 `/session/viewed` 场景，以及对应的专用测试（`tui-session-presence-contract`、connection-service viewed 测试块、workspace-routing viewed 测试）。

待完成范围：

- 剩余最小范围类型检查与人工验收（按用户指示不进行构建验证）。

### 验收

每个小批次单独确认：

- 对应命令、后台服务、面板和设置消失。
- 扩展启动接线减少。
- 两项保留功能正常。

### 阶段 5 任务清单（2026-08-14 起，跨会话推进）

> 本清单供跨会话跟踪。每完成一项把 `[ ]` 改为 `[x]` 并在「进度」小节追加一行。一次会话做不完，允许后续会话继续。

**方案确认（2026-08-14）**：最小配置入口采用「保留精简设置 Webview」——复用现有设置页与后端配置/API Key 存储机制，不引入 VS Code 原生设置同步层。

**UX 确认（2026-08-15，用户澄清）**：设置入口采用「侧栏导航 + 宽幅内容」两栏形态。活动栏 Kilo 图标打开**窄侧栏设置导航**（`src/settings-nav.ts` 的 `SettingsNavProvider`，viewType `kilo-code.SidebarProvider`），点击某一项（providers / autocomplete / commitMessage / language / aboutKiloCode）后再打开**宽幅设置页（编辑器区域面板）** `SettingsEditorProvider.openPanel("settings", tab)` 显示该 tab 内容，侧栏保持打开便于快速切换。`Settings.tsx` 不再渲染内嵌导航（移除 `Tabs.List`）。导航标签 zh/zht/en 内嵌于扩展（`TAB_LABELS`），其余语言回退英文。原「点击活动栏直接打开宽面板并收起侧栏」的启动器方案（`src/settings-launcher.ts`）已移除。

**已完成调查（2026-08-14）**：

- 设置面板不是独立 Webview：`SettingsEditorProvider` 内部为每个面板创建完整 `KiloProvider`（`SettingsEditorProvider.ts:100-105`），与侧栏共用同一个 `dist/webview.js`（唯一 webview 入口 `webview-ui/src/index.tsx`，`esbuild.js:271-299`），靠 `navigate` 消息切视图（`App.tsx:252-275`）。
- 保留功能依赖：补全读 VS Code 设置 `kilo-code.new.autocomplete.*`（`services/autocomplete/AutocompleteServiceManager.ts:42-60`），FIM 经 `client.kilo.fim` 走后端；提交信息读后端配置 `commit_message.model` + VS Code 设置 `kilo-code.new.languageCommitMessage`（`services/commit-message/index.ts:104-107`）。两者都只依赖 `KiloConnectionService`，不直接依赖聊天 UI。
- 设置保存消息：`updateConfig`→`client.global.config.update`/`client.config.update`（`provider-actions.ts:248-254`）、`updateSetting`→写 VS Code 设置（`KiloProvider.ts:3794-3822`）、`connectProvider`/`saveCustomProvider`→`client.auth.set` 写 API Key（`provider-actions.ts:295-314,425-489`）。
- 保留的设置 tab 范围已基本被 `Settings.tsx:30` 的 `visibleTabs` 框出：providers / autocomplete / commitMessage / language / aboutKiloCode；`components/settings/` 下大量未引用 tab（ModelsTab、DisplayTab、ContextTab 等）是死代码。
- package.json 中存在声明但从未注册的死命令：`explainCode`/`fixCode`/`improveCode`/`addToContext`/`terminalAddToContext`/`terminalFixCommand`/`terminalExplainCommand`/`focusChatInput`/`toggleChatSearch`。

**任务清单**：

- [x] **T0 安全清理 package.json 死命令**：删除声明但未注册的聊天命令（explainCode/fixCode/improveCode/addToContext/terminalAddToContext/terminalFixCommand/terminalExplainCommand/focusChatInput/toggleChatSearch）、对应 submenu（editorContextMenu/terminalContextMenu）与 editor/context、terminal/context、相关快捷键（focusChatInput、addToContext）。
- [x] **T1 建立最小设置 Provider（必须先解决，核心）**：
  - [x] 新建 `src/SettingsProvider.ts`，替代 `KiloProvider` 服务设置面板。需处理消息：`webviewReady`、`requestConfig`、`requestGlobalConfig`、`updateConfig`、`updateSetting`、`requestAutocompleteSettings`、`requestProviders`、`connectProvider`、`authorizeProviderOAuth`、`completeProviderOAuth`、`disconnectProvider`、`saveCustomProvider`、`fetchCustomProviderModels`、`setLanguage`、`openConfigFile`、`closePanel`、`navigate`、`settingsTabChanged`。
  - [x] 复用 `provider-actions.ts` 的 config/auth 写入与 `buildWebviewHtml`（`src/utils.ts:55-114`）装配 webview。
  - [x] 迁移 `syncWebviewState` / `sendConfig` / `sendProviders` 最小逻辑（参考 `KiloProvider.ts`）。
  - [x] 改造 `SettingsEditorProvider.ts`：用 `SettingsProvider` 替代 `KiloProvider`。
  - [x] 删除 `src/KiloProvider.ts` 及 `src/kilo-provider/` 中仅被聊天使用的目录。
- [x] **T2 精简 Webview（设置页保留，聊天删除）**：
  - [x] `App.tsx`：已重写为仅设置页；删除 ChatView/HistoryView/ProfileView 分支、DataBridge、SidebarTopBar、聊天副作用 import。
  - [x] `provider-shell.tsx`：已精简为只保留 `Root`，移除 Session/Chat 片段与 SpeechToTextPrewarm。
  - [x] `Settings.tsx`：已移除 `useSession().allStatusMap()` 的 busy 警告依赖，保存直接调 `saveConfig()`。
  - [x] 删除 `webview-ui/src/components/chat/`、`components/history/`、`components/profile/`、`components/speech-to-text/`（**级联**：`tsconfig.json` include `src/**/*` 覆盖 stories，须同步删除聊天 stories；Playwright spec 引用 stories 属 T5）。
  - [x] 精简 `webview-ui/src/context/`：删除 session/transcript/agent-requirements/permission/feedback/memory 等聊天 context。**关键耦合**：`components/shared/ModelSelector.tsx` 的 `ModelSelectorBase`（AutocompleteTab/CommitMessageTab 使用）模块级 `import { useSession, SessionContext } from context/session`（`ModelSelector.tsx:31`），运行时用 `if (!session)` 守卫（`ModelSelector.tsx:152,249-291`）。删除 `context/session.tsx` 前必须先解除该 import——方案：新建最小 model-favorites context（favoriteModels/modelUsageHistory/toggleFavorite）或把 ModelSelectorBase 的 session 用法改为 props。
  - [x] 删除未启用的死设置 tab（ModelsTab、DisplayTab、ContextTab、AgentBehaviourTab、SandboxingTab、CheckpointsTab、ExperimentalTab、IndexingTab、BrowserTab、McpEditView、agent-behaviour/ 等，它们引用聊天 context，`Settings.tsx:30` 的 visibleTabs 未包含）。
  - [x] 精简 `types/messages/`、`hooks/`、`styles/`、`stories/` 中的聊天部分。**注意**：`styles/chat.css` 是 webview 唯一样式入口，`@import` 了 `settings.css`/`model-selector.css`/`dialogs.css` 等全部样式；`App.tsx` 必须保留 `import "./styles/chat.css"`，删除聊天时只能裁剪被 import 的聊天样式，不能删整个入口。其它样式文件（如 `settings.css`）无独立 import。（**types/messages 的聊天消息联合类型未裁剪，推迟至 T6 谨慎处理**）
- [x] **T3 清理 extension.ts 激活接线**：已重写 `src/extension.ts`——删除 `KiloProvider` 创建与聊天 sidebar view 注册、TabPanel 序列化器与 `tabPanels`/`openKiloInNewTab`、聊天命令（plusButtonClicked/historyButtonClicked/cycleAgentMode/cyclePreviousAgentMode/profileButtonClicked/openIndexingSettings/showMemory/toggleMemory/generateTerminalCommand/openInTab/reload/sidebarTitle.*）、URI 深链；新增 `SettingsLauncherProvider` 使活动栏图标打开宽设置面板；保留 autocomplete、commit-message、`settingsButtonClicked`、设置面板序列化器、heap-snapshot。**注意**：`SettingsEditorProvider` 仍用完整 `KiloProvider`（T1 未做），`extension.ts` 已不再直接创建 KiloProvider。package.json 中已移除的命令/菜单/配置残留属 T4。
- [x] **T4 清理 package.json 贡献点**：
  - [x] `commands` 数组已清理：仅剩 `settingsButtonClicked`、autocomplete.*（4 个）、`generateCommitMessage`、`pauseCommitMessageGeneration`、`takeHeapSnapshot`。
  - [x] **悬空菜单/快捷键已清理**：删除 `menus.commandPalette`（sidebarTitle.*）、整个 `menus.view/title`（openInTab + sidebarTitle.*）、整个 `menus.editor/title`（openInTab + plusButtonClicked/historyButtonClicked/profileButtonClicked/settingsButtonClicked）、keybindings 中 `generateTerminalCommand`/`cycleAgentMode`/`cyclePreviousAgentMode`。已确认 `autocomplete.showIncompatibilityExtensionPopup` 仍注册（`services/autocomplete/index.ts:46`），其 keybinding 保留。
  - [x] **保留** `viewsContainers.activitybar` 与 `views`（`kilo-code.SidebarProvider` 启动器视图必须保留）；保留 `scm/title`、`scm/input`。
  - [x] `configuration` 键：**未盲删**——逐一验证后保留 `language`（LanguageTab + AutocompleteServiceManager）、`languageCommitMessage`（提交信息）、`autocomplete.*`（补全）、`fontSize`（webview）、`claudeCodeCompat`（`server-manager.ts:95`）、`extraCaCerts`（`server-manager.ts:116`）、`agentWorkStyle`（kilo-provider/work-style，本轮未确认保留组件使用，暂留）；删除确认无人读取的死键：`model.providerID`/`model.modelID`（无 reader）、`indexing.showButtonWhenDisabled`、`maxCost`、`showTaskTimeline`、`showTokenThroughput`、`showAutoApprovalReason`、`chat.shiftTabCyclesVariant`（reader 均在已删的 KiloProvider/kilo-provider 死文件或已删 webview 死 tab 中）。
  - ~~T4 重复条目~~（原方案曾建议删除 activitybar/views，与 2026-08-15 确认的启动器方案矛盾，已按保留执行）。
- [x] **T5 清理测试/构建配置**：删除引用 `KiloProvider` 与 chat 组件的单测、聊天 Playwright spec 与 stories；检查 esbuild.js / tsconfig / knip / eslint.config.mjs 对 `src/KiloProvider.ts` 的专项规则（`eslint.config.mjs:40`）。详见下方进度（2026-08-15 本轮完成）。
- [x] **T6 清理残留符号**：全仓搜索残留命令 ID、viewType、消息类型、i18n key 引用。详见下方进度（2026-08-15 本轮完成）。
- [ ] **T7 人工验收**：按「8. 人工验证清单」逐项确认补全、提交信息、设置入口。

**进度**：

- 2026-08-14：完成调查与方案确认；写入本任务清单。
- 2026-08-15：完成 T0（package.json 死命令清理）。完成 T2 的 Webview 入口精简（App.tsx 重写为仅设置页、provider-shell 只保留 Root、Settings.tsx 移除 useSession）——中间态安全：KiloProvider 仍处理全部设置消息，聊天组件暂为死代码未删除。剩余：聊天目录/context/stories 删除（含 ModelSelectorBase/session 耦合处理）、T1 最小 SettingsProvider、T3 extension.ts 接线、T4 贡献点清理、T5 测试/构建清理。
- 2026-08-15（继续）：用户澄清 UX——活动栏图标应打开**宽幅设置页**而非窄侧栏设置。新增 `src/settings-launcher.ts`（`SettingsLauncherProvider`，viewType `kilo-code.SidebarProvider`），点击后 `settingsEditorProvider.openPanel("settings")` + 延迟 50ms `workbench.action.closeSidebar`。重写 `extension.ts`：删除 KiloProvider/聊天命令/URI 深链/TabPanel，保留设置面板/补全/提交信息。package.json `commands` 数组已清理。
- 2026-08-15（停止点）：用户指示停止继续改动，未完成任务已更新到本清单。当前状态：**中间态，未构建验证**。遗留不一致需下轮处理：① package.json 的 `menus.commandPalette`/`view/title`/`editor/title` 与 3 个 keybindings 仍引用已移除命令（悬空，功能无害但未清理）；② `SettingsEditorProvider` 仍用完整 `KiloProvider`（T1 未做）；③ 聊天组件目录/context/stories 未删除（T2 剩余）；④ `extension.ts` 已移除命令的菜单快捷键在 T4 收尾。
- 2026-08-15（本轮，跨会话推进）：完成 **T2** 全部剩余与 **T4** 全部收尾；**T1 完成研究但未实现**（用户中途叫停，只做文档记录）。

  **T2 已删除（webview 设置页保留、聊天清空）**：
  - 整目录：`components/chat/`（43 文件）、`components/history/`、`components/profile/`、`components/speech-to-text/`、`hooks/`（12 文件）、`context/onboarding/`。
  - `context/` 删除 38 个聊天 context：session.tsx、transcript-rows/transcript-search、agent-requirements、permission-queue、feedback、memory、notifications、indexing、image-models、kilo-embedding-models、speech-to-text-models、local-tabs、work-style、worktree-mode、session-*（agent/cloud-prune/errors/merge/model-selector/model-store/outcome/parts/preferences/queue/utils/variants/variant-store）、abort-state、cost-alert、model-selection、model-usage、part-stash、todo-revert。
  - `components/settings/` 删除死 tab：ModelsTab、DisplayTab、ContextTab、AgentBehaviourTab、SandboxingTab、CheckpointsTab、ExperimentalTab、IndexingTab、BrowserTab、McpEditView、ModeCreateView、ModeEditView、PermissionEditor、agent-behaviour/、agent-behaviour-patches、indexing-tab-state、mode-io、mode-model、permission-utils、sandboxing。
  - `components/shared/` 删除死组件：AccountSwitcher、BalanceChip、BranchSelect、ModeSwitcher、SandboxButton、SessionRenameEditor、ThinkingSelector、TurnOutcome、WorkingIndicator、WorkStylePicker、working-indicator-utils。
  - `utils/` 删除 19 个聊天 util（含 timeline/、transcript-parts），保留 8 个被引用 util。
  - `styles/` 删除 22 个聊天样式，`chat.css` 精简为仅 @import model-selector/dialogs/settings/high-contrast 4 个（App.tsx 仍 `import "./styles/chat.css"`）。
  - `stories/` 删除 8 个聊天 story，重写 `StoryProviders.tsx`（移除 Session/Feedback/Notifications/Memory/Indexing/KiloEmbedding/TranscriptSearch context）、`settings.stories.tsx`（仅保留 5 个有效 story）、`shared.stories.tsx`（移除依赖 session 的 2 个 story）；`anaconda-desktop.stories.tsx` 保留。Storybook main.ts 用 glob，无需改。
  - **session 解耦方案（未用新 context，改为直置 undefined）**：`ModelSelector.tsx` 删除 `import { useSession, SessionContext }`、`useContext(SessionContext)` 改 `const session = undefined`、删除末尾死 `ModelSelector` chat 包装；`ModelPreview.tsx` 删除 SessionContext import 与星标块。设置页恒传 `favorites={false}`，行为不变。
  - **附带精简**：`context/display.tsx` 移除 throughput/autoApprovalReason/thinking 折叠，只留 fontSize；`context/config.tsx` 移除 indexing/chat/throughput/autoApproval 的 settings 请求与 `loadedSettings` 分支。
  - **验证**：webview `src` 全部相对 import 可解析；无对已删除目录/context/hooks/utils/stories 的残留引用。

  **T4 已收尾**：删除全部悬空菜单（commandPalette/view/title/editor/title）与 3 个 keybinding；删除 8 个死 configuration 键；保留 activitybar/views/SidebarProvider 启动器与 scm 菜单；修复删除后遗留的 JSON 尾逗号（`node JSON.parse` 通过）。

  **T1 未实现（研究已完成）**：已通读 `KiloProvider.ts` 消息处理器（webviewReady/requestConfig/requestGlobalConfig/requestAutocompleteSettings/updateConfig/updateSetting/requestProviders/connectProvider*/disconnectProvider/saveCustomProvider/fetchCustomProviderModels/setLanguage/openConfigFile/openVSCodeSettings/reload/resetAllSettings/resetReadNotifications/persistModelSelectorExpanded/requestModelSelectorExpanded/copyToClipboard/saveImage/telemetry）、`syncWebviewState`、`fetchAndSendConfig/GlobalConfig/ConfigUpdated/Providers`、`handleUpdateConfig`（含 config-bindings/fetchSnapshot）、`handleUpdateSetting`、`initializeConnection`、`postMessage`、`dispose`、`buildWebviewHtml`、`config-snapshot.ts`、`config-bindings.ts`。新建 `src/SettingsProvider.ts` 所需代码路径均已定位（provider-actions.ts 复用、fetchSnapshot、ConfigBindings、buildAutocompleteSettingsMessage/watchAutocompleteConfig/validAutocompleteSetting、openConfig、saveImage、fetchOpenAIModels、watchFontSizeConfig、connectionService.onStateChange/onEventFiltered/connect/getServerInfo/getServerConfig/notifyLanguageChanged/notifyModelSelectorExpandedChanged、`extensionDataReady` 在 `KiloProvider.ts:1645` 发送）。**下轮从「编写 SettingsProvider.ts → 改造 SettingsEditorProvider → 删除 KiloProvider.ts」继续**。

- 2026-08-15（本轮）：**完成 T1 全部实现**（用户指示停止进一步改动，仅更新文档）。

  **T1 已实现**：
  - 新建 `src/SettingsProvider.ts`（约 880 行）：最小设置 Provider，复用 `provider-actions.ts`（buildActionContext/fetchProviderData/computeDefaultSelection/connectProviderAction/authorizeOAuthAction/completeOAuthAction/disconnectProviderAction/saveCustomProviderAction/resolveStoredKey）、`buildWebviewHtml`（`src/utils.ts`）、`fetchSnapshot`（config-snapshot.ts）、`ConfigBindings`（config-bindings.ts）、`buildAutocompleteSettingsMessage/watchAutocompleteConfig/validAutocompleteSetting`（services/autocomplete/settings.ts）、`openConfig`、`saveImage`、`fetchOpenAIModels`、`watchFontSizeConfig`。
  - 消息处理（对照 webview 设置页实际发送）：`webviewReady`、`requestConfig`、`requestGlobalConfig`、`requestAutocompleteSettings`、`updateConfig`（含 overlayUpdate + binding 校验 + drainPendingPrompts）、`updateSetting`（autocomplete 校验）、`requestProviders`、`connectProvider/authorizeProviderOAuth/completeProviderOAuth/disconnectProvider/saveCustomProvider`、`fetchCustomProviderModels`、`setLanguage`、`openConfigFile`、`saveImage`、`reload`、`openVSCodeSettings`、`resetAllSettings`、`resetReadNotifications`、`openExternal`（补充，原 KiloProvider 无 handler）、`copyToClipboard`、`requestModelSelectorExpanded/persistModelSelectorExpanded`；`webviewFocusChanged`/`settingsTabChanged`/`closePanel` 忽略（无 focusContext；后两者由 SettingsEditorProvider 处理）。
  - 状态同步：`doInitializeConnection`（connect → onStateChange → syncWebviewState → fetchAndSendProviders+fetchAndSendConfig → `extensionDataReady`）、`syncWebviewState`（ready/connectionState/workspaceDirectory/fontSize）、`refreshConfig`、`postConfigFailure`、`handleReload`、`handleResetAllSettings`（重置 `kilo-code.new.*` + 清 modelSelectorExpanded/dismissedNotificationIds + 重发 autocompleteSettings + 重拉 config）。
  - **明确不做**（移除或超出范围，与裁剪方向一致）：chat/session/agent/permission/MCP/memory/notifications 列表/remote/indexing/sandboxing/telemetry 推送、SSE session 事件过滤、profileData 拉取、Kilo Gateway `login` 设备授权（Profile 视图已删、无展示授权码的 UI）。
  - 改造 `src/SettingsEditorProvider.ts`：`SettingsProvider` 替代 `KiloProvider`（构造参数 `{ projectDirectory, hideTopBar: true }` 不变）。
  - 删除 `src/KiloProvider.ts`（190KB）；删除 `src/kilo-provider/` 中仅被聊天使用的 41 个文件 + `handlers/` 目录（abort/agent-requirements*/auto-approval-reason-settings/background-process/chat-settings/command-completion/commands/early-message/export-transcript/file-*/followup-session/fork-session/git-changes-*/git-status/indexing-settings/mcp-oauth/memory/message-files/message-page/model-state/model-usage/native-tab-title/network/options/remove-config-item/rename-session/session-search/slim-metadata/task-session/throughput-settings/visible-task-streams/work-style* 与 handlers/{auth,cloud-session,permission-handler,question,suggestion}）。
  - **保留的 kilo-provider 文件**（SettingsProvider/共享代码复用）：`config-bindings.ts`、`config-snapshot.ts`、`config-file.ts`（open-config 依赖）、`font-size.ts`、`notifications.ts`、`open-config.ts`、`save-image.ts`、`session-stream-scheduler.ts`（kilo-provider-utils.ts 导出引用）。
  - **验证**：IDE 诊断确认 `SettingsProvider.ts`/`SettingsEditorProvider.ts`/`extension.ts`/`settings-launcher.ts`/`kilo-provider-utils.ts` 无类型错误；grep 确认保留代码（src 非测试）无对 KiloProvider 或已删 kilo-provider 模块的 import。按用户指示未做构建验证。
  - **遗留至 T5**：① 删除引用 KiloProvider 与已删 kilo-provider 模块的单测（kilo-provider-*.test.ts、chat 相关单测等）；② `eslint.config.mjs:40` 等对 `src/KiloProvider.ts` 的专项规则；③ esbuild.js / tsconfig / knip 中相关条目检查。

- 2026-08-15（本轮）：**完成 T5 与 T6**（用户指示本轮做 T5/T6；未做构建验证，仅 IDE 诊断 + import 存在性脚本核对）。

  **T5 已完成**：
  - 用脚本按「相对 import 目标存在性」全量扫描 `tests/unit/`、`tests/*.spec.ts`、`webview-ui/src/**/*.stories.tsx`，识别并删除引用已删模块的失效文件：
    - 删除 **103 个单测**（97 个直接 import 失效 + `font-size-arch`/`message-contract`/`new-worktree-dialog-sandbox`/`revert-checkpoints` 4 个以字符串路径引用 `src/KiloProvider.ts` 或已删 chat 组件 + 引用失效 fixtures 的 2 个）；保留 99 个有效单测。
    - 删除 **9 个失效 Playwright spec**（`accessibility`/`diff-scroll-preservation`/`history-accessibility`/`indexing-provider-blur-race`/`model-selector-accessibility`/`permission-diff`/`permission-dock-dropdown`/`settings-accessibility`/`skills-settings-responsive`，均引用已删 profile/agentmanager/chat/history/indexing/permission/sandboxing/agent-behaviour/session-tabs stories）。保留 `markdown-incremental-dom`/`markdown-mermaid`/`visual-regression`（后者动态拉取现存 stories）。
    - 删除 **2 个失效 fixtures**（`question-dock-disposal.tsx`/`session-tab-switcher.tsx`，引用已删 `components/chat/*`）+ `tests/fixtures/` 目录。**关键判定**：`kilo-ui-contract.test.ts` 通过 `Bun.spawnSync` 在 `packages/kilo-ui` 内运行，引用 `kilo-ui` 的 message-part/data/basic-tool（均存在），**保留**。
  - 清理 `eslint.config.mjs` 中对已删文件的 8 个复杂度规则块（`src/KiloProvider.ts`、`webview-ui/agent-manager/AgentManagerApp.tsx`、`src/agent-manager/AgentManagerProvider.ts`、`webview-ui/src/components/chat/PromptInput.tsx`、`src/legacy-migration/migration-service.ts`、`webview-ui/src/components/migration/MigrationWizard.tsx`、`webview-ui/src/context/session.tsx`、`webview-ui/src/utils/errorUtils.ts`），并把 `WorktreeManager.ts + QuestionDock.tsx` 合并块精简为仅 `WorktreeManager.ts`；保留仍存在文件的规则（BracketMatchingService、kilo-provider-utils、server.tsx 等）。
  - esbuild.js / tsconfig（含 webview）/ knip.json / script/*.ts 均无对已删模块的引用，无需改动；`package.json` `test:unit`（`bun test tests/unit/`）自动发现剩余测试。

  **T6 已完成**：
  - 命令 ID：全仓搜索已删命令（explainCode/fixCode/improveCode/addToContext/terminal*/focusChatInput/toggleChatSearch/plusButtonClicked/historyButtonClicked/cycleAgentMode/profileButtonClicked/openInTab/generateTerminalCommand/sidebarTitle.*/kiloclaw/marketplace）无残留。
  - viewType：删除 `extension.ts` 中 `profilePanel` serializer（`settingsViews` 改为仅 `["settingsPanel"]`）；`SettingsEditorProvider.PanelView` 由 `"settings"|"profile"|"indexing"` 精简为仅 `"settings"`，`viewFromType` 只认 `kilo-code.new.settingsPanel`，旧 profile/indexing 面板反序列化时会被 dispose；`PANEL_TITLES` 同步精简。
  - 死配置：删除 `package.json` 中 `kilo-code.new.agentWorkStyle`（T1 已删 kilo-provider/work-style*，确认无 reader）；删除 `extension.ts` 中 `setContext("kilo-code.new.isCursor", …)`（T4 已删 view/title、editor/title 菜单，无 when 消费该 context）及其 import。
  - i18n key：脚本提取保留 webview 代码全部 `t("…")`，发现 4 个缺失 key（`provider.connect.kiloGateway.byok.prefix/link/suffix`、`settings.providers.group.recommended`），已补入 `webview-ui/src/i18n/en.ts`（其余语言经 `t()` 回退到 en），复查 259 个 used keys 全部有定义。
  - 已删模块 import：src/ webview-ui/ script/ 相对 import 全量检查无失效引用（autocomplete 的 `.js` 后缀为 ES module 风格正常引用）；IDE 诊断确认改动文件与全仓无类型错误。

  **遗留（后续阶段处理，本轮不扩大范围）**：
  - `knip` 报告 8 个 unused files + 18 个 unused exports + 4 个 unused types（`src/speech-to-text/*`、`src/agent-manager/*` 若干、`src/services/telemetry/webview-state.ts`、`src/review-utils.ts`、`src/indexing-consent.ts`、`src/shared/sandbox-session.ts` 等）。已用 git 比对确认被删测试**不引用**这些导出，属 T1–T4 遗留死代码，建议随阶段 3/7/10 的功能整体清理时处理（agent-manager、telemetry、speech-to-text、sandbox 均为待删功能）。
  - `webview-ui/src/types/messages/` 的聊天消息联合类型（webview-messages.ts 1452 行、extension-messages.ts 1310 行等，含 workStyleLoaded、sendMessage 等已删消息成员）未裁剪：它们被保留设置页 `postMessage`/`ExtensionMessage` 类型检查引用且彼此互相 import，裁剪需同步重构联合类型，风险高收益低，建议在阶段 6/8 重构调用层时处理。
  - i18n 文件中的死 key（workStyle.*、聊天/通知/索引相关等）未清空：属阶段 10「删除失效多语言文案」，且 `t()` 缺失时回退 en 不破坏运行。
  - **`tests/unit/kilo-ui-contract.test.ts` 部分失效（本轮运行 `bun test` 后发现）**：该文件 3 个 describe 块用 `readFileSync` 读取 T2 已删的 webview 文件——`AssistantMessage visible row contract`（`components/chat/AssistantMessage.tsx`、`utils/transcript-parts.ts`）、`Memory control placement contract`（`chat/TaskHeader.tsx`、`settings/ContextTab.tsx`、`chat/PromptInput.tsx`）、`Assistant transcript spacing contract`（`styles/chat-layout.css`）——运行时抛 `ENOENT`，且 6 个对应常量成为未使用定义。其余 describe（引用 `packages/kilo-ui` 的 message-part/data/basic-tool/shell-rolling 等，均存在）**保留**。**处理方式（待继续）**：删除这 3 个 describe 块与 6 个常量定义，保留 kilo-ui 契约部分。（**已于 2026-08-15 收尾轮处理，见下方进度；`bun test tests/unit/kilo-ui-contract.test.ts` 恢复 35 pass / 0 fail**）
  - **本轮 `bun test tests/unit/` 结果**：1241 pass / 27 fail / 9 errors。失败集中在 `worktree-manager`（git push 环境差异）、`ProjectContexts`、`GitOps/GitStatsPoller`（git 环境）、`Bubblewrap`（Windows 缓存权限）等 agent-manager/git 环境类问题，与本次删除无关（剩余测试 import 与 preload 均已核对完整）；上述 kilo-ui-contract 的 ENOENT error 是唯一与本轮删除直接相关的运行失败。

- 2026-08-15（本轮，**第五阶段收尾**）：完成第五阶段剩余的全部代码收尾，仅剩 T7 人工验收（用户执行）。

  **第五阶段收尾已完成**：
  - 用字符串路径扫描补上 T5「相对 import 存在性扫描」遗漏的死测试：删除 `tests/unit/session-select-connection.test.ts`（整文件依赖 T2 已删的 `webview-ui/src/context/session.tsx`）与 `tests/unit/question-dock-contract.test.ts`（整文件依赖 T2 已删的 `webview-ui/src/components/chat/QuestionDock.tsx`）。
  - 修复 `tests/unit/kilo-ui-contract.test.ts`：删除引用已删 webview 文件的 3 个 describe 块（`AssistantMessage visible row contract` / `Memory control placement contract` / `Assistant transcript spacing contract`）与 6 个死常量（`ASSISTANT_MESSAGE_FILE`/`TASK_HEADER_FILE`/`CONTEXT_TAB_FILE`/`PROMPT_INPUT_FILE`/`TRANSCRIPT_PARTS_FILE`/`CHAT_LAYOUT_FILE`）；保留引用 `packages/kilo-ui` 的契约部分。
  - **验证**：`bun test tests/unit/kilo-ui-contract.test.ts` 恢复 **35 pass / 0 fail**；全包 grep 确认无对已删目录（chat/history/profile/speech-to-text 组件、context/session、transcript-parts、chat-layout）的字符串引用。`context/provider.ts` 缺失不构成问题：`import ... from "../../context/provider"` 经 TS 扩展解析落到 `context/provider.tsx`（存在）。按用户指示未做构建验证。
  - **第五阶段剩余**：仅 T7 人工验收——按「8. 人工验证清单」确认代码补全、Git 提交信息、设置入口（活动栏图标打开宽幅设置页）以及「被移除功能」项均符合预期。

## 阶段 5：移除普通 Agent 聊天和会话 UI

### 原因

普通 Sidebar Chat 是当前扩展的主界面，并与设置、Provider、Session、权限、工具调用、历史和 CLI 后端深度耦合。它不是适合优先删除的模块。

### 主要范围

重点调查：

```text
packages/kilo-vscode/src/KiloProvider.ts
packages/kilo-vscode/webview-ui/src/
packages/kilo-vscode/src/kilo-provider/
```

逐步移除：

- Activity Bar 容器和 Sidebar Webview。
- New Task、History、Open in Tab 等命令。
- Session、Agent、Tool、Permission、Message 和 History Context。
- 聊天消息渲染、附件、终端动作和任务执行。
- 任务历史、项目记忆、模式选择、Agent 选择。
- Kilo 主 Webview 构建入口。

### 必须先解决

设置界面当前可能复用主 Webview 的组件和消息桥接。删除主 Webview 前，必须先建立最小配置入口，例如：

- 直接使用 `contributes.configuration`；或
- 保留一个独立轻量设置 Webview。

### 验收

- Activity Bar 中不再有聊天侧栏，点击之后直接打开设置页。
- 扩展激活不再创建 `KiloProvider`。
- 不再有 Session、Agent、Tool 或 Permission 交互。
- OpenAI 配置入口仍可用。
- 两项保留功能正常。

## 阶段 6：建立最小 OpenAI 兼容配置与调用层

### 原因

前几阶段主要删除 UI 叶子功能。本阶段确定配置/调用层方案：按方案 B 保留最小 CLI 后端，提交信息经现有 Provider/LLM 体系调用自定义 OpenAI 兼容 provider，补全保持内置 FIM；后续从 CLI 剥离外围模块。

### 最小配置

最终仅需要以下配置，由现有设置页自定义 provider 流程提供（不新增三字段表单）：

```text
baseUrl
apiKey
model
```

可选保留：

```text
autocomplete.enabled
autocomplete.mode
commitMessage.language
commitMessage.prompt
```

### 配置存储（2026-08-15 已确认）

- 保持现状，全部走后端 `config` + `auth store`，不引入 VS Code SecretStorage。
- Base URL / Model / 开关：CLI config（`provider.{id}.options.baseURL`、`commit_message.*` 等）。
- API Key：CLI `auth store`（`~/.local/share/kilo/auth.json`，权限 0600，明文）。
- 不猜测第三方接口路径；提交信息走 Chat Completions（OpenAI 兼容通用格式）。

### 调用层（2026-08-15 已确认：方案 B 保留最小 CLI 后端）

- 保留 `kilo serve` 子进程 + SDK/HTTP，提交信息和补全仍经 CLI 后端执行。
- 提交信息经现有 Provider/LLM 体系（`commit_message.model = provider@model`），支持 `@ai-sdk/openai-compatible` 自定义 provider。
- 补全保持内置 FIM provider 目录（FIM 各厂商格式不通用，不接自定义 baseUrl）。
- 剥离路径：保留核心（LLM/Provider/Session/Agent），只删外围。

### 验收

- 通过现有自定义 provider 流程配置 Base URL、API Key 和 Model 后即可使用提交信息。
- 提交信息经 CLI 自定义 OpenAI 兼容 provider（Chat Completions）工作；补全经内置 FIM provider 工作。
- 提交信息不依赖 Kilo 账号或 Gateway 即可调用模型。
- 请求支持取消和合理超时。
- API Key 存 CLI auth store，不出现于日志、错误信息或 `settings.json`。

### 方案 B 执行记录（2026-08-15）

**调用层方案已确认：方案 B（保留最小 CLI 后端）**。用户明确三件事：

1. **配置存储保持现状**：Base URL / API Key / Model 仍走后端 `config` + `auth store`（经现有自定义 provider 流程写入 `provider.{id}`），不引入 VS Code SecretStorage。
2. **剥离路径：保留核心、只删外围**：提交信息依赖的 LLM/Provider/Session 核心链路保留不动；只剥离 TUI、云 handler、索引/记忆/sandbox/mcp 等外围模块。**不重写提交信息/补全内部调用**。
3. **第六阶段同时开始剥离 CLI**（不限于配置层）。

**调查结论（2026-08-15）**：

- **补全（FIM）链路**：扩展 `AutocompleteServiceManager` 读 `kilo-code.new.autocomplete.provider/model` → `generateFim()`（`services/autocomplete/fim.ts`）→ SDK `client.kilo.fim` → 后端 `/kilo/fim` handler（`kilocode/server/httpapi/handlers/kilo-gateway.ts:121`）→ `resolveFimTarget()`（`kilo-gateway/src/fim.ts`，硬编码 5 个 provider URL）→ `auth.get()` 取 token → OpenAI 兼容 FIM 请求（`buildFimPayload` 已通用）。**FIM 链路依赖小，剥离周边容易，但当前不支持自定义 baseUrl**。
- **提交信息链路**：扩展 `registerCommitMessageService` → `client.commitMessage.generate` → 后端 `/commit-message/generate` handler（`handlers/commit-message.ts`，读 Config `commit_message.prompt/model`）→ `generateCommitMessage()`（`kilocode/commit-message/generate.ts`，经 `Provider.Service` + `LLM.Service` + `Agent.Info` + `AppRuntime`）→ 已支持 `provider@model` 与 `@ai-sdk/openai-compatible` 自定义 provider。
- **依赖事实**：`session/llm.ts` 依赖 Provider/Config/Auth/Plugin/Permission/EventV2Bridge/KiloSession/SessionExport/InstanceState。**提交信息复用 LLM 体系 ⇒ Agent/Session/Provider/Permission/Plugin 无法从 CLI 剥离**（保留核心路径的结构性约束）。可剥的只有不在这条链路里的外围模块。
- **CLI 服务端全貌**：HTTP 服务（`server/routes/instance/httpapi/server.ts`）聚合约 18 个 Kilo 特有路由组 + 20 个共享路由组 + 50 个服务节点。Kilo 特有组注册点：`kilocode/server/httpapi/server.ts:31-50`。
- **CLI auth store**：`~/.local/share/kilo/auth.json` 明文 0600，无加密（`packages/opencode/src/auth/index.ts`）。

**执行步骤（跨会话推进，每完成一项更新进度）**：

> **2026-08-15 调整（用户确认）**：**FIM 不接自定义 provider**——各厂商 FIM 适配格式不通用（Mistral `/v1/fim/completions` prefix/suffix、DeepSeek `/beta/completions`、DashScope `<|fim_prefix|>` 模板等），无法用统一格式适配任意 baseUrl。因此最小配置（Base URL / API Key / Model）只驱动**提交信息**（Chat Completions 为通用 OpenAI 格式）；**补全保持内置 FIM provider 目录选择**（kilo/mistral/inception/deepseek/alibaba-cn）。

- [x] **S1 设置页保持现状（2026-08-15 用户确认，不改代码）**：不重写、不删除设置页。现有 `CustomProviderDialog` 已能配置 Base URL / API Key / Model（写后端 `provider.{id}` + auth store），`CommitMessageTab` 可选择该 provider 的模型用于提交信息（`commit_message.model = {id}@<model>`）。最小配置能力由现有渠道商流程提供，无需新增三字段表单，不删 Provider 目录 / OAuth / 禁用管理等 UI。
- [ ] **S4 人工验收**：通过现有自定义 provider 流程配置 Base URL / API Key / Model 后，提交信息可用且不依赖 Kilo 账号/Gateway；补全用内置 FIM provider 工作。
- [ ] **S5 剥离 Kilo 特有 handler（外围）**：从 `kilocode/server/httpapi/server.ts` 移除 agentBuilder、anacondaDesktop、backgroundProcess、branchName、enhancePrompt、indexing、instanceReload、interactiveTerminal、memory、network、sandbox、sessionImport、suggestion、telemetry；保留 commitMessage、kiloGateway（fim/authStatus）、kilocode（必要）、configConsole。删除对应 handler/groups 文件。
- [ ] **S6 剥离共享路由组（外围）**：从 `server.ts` instance routes 移除 experimental、mcp、permission、question、session、sync、tui、pty、project、projectCopy、workspace、control、controlPlane、file（确认 git-context 不用 file 后再删）。**注意**：`connection-service.ts` 的 `drainPendingPrompts` 仍调用 permission/question/suggestion/network，设置保存前需同步移除该调用。
- [ ] **S7 剥离服务节点（外围）**：从 app 服务图移除 Account、Skill、Discovery、Question、Permission、PermissionSaved、Todo、MCP、McpAuth、Command、Truncate、ToolRegistry（确认 LLM 不依赖）、Format、Project、Vcs、Workspace、Worktree、Installation、ShareNext、SessionShare、SyncEvent、AgentManager、MemoryService、MoveSession、PtyTicket、ProjectV2、ProjectCopy、Session（确认 LLM/KiloSession 不依赖共享 Session 节点）。保留 Provider/ModelCache/ProviderAuth/Agent/Config/Auth/Storage/Database/FSUtil/Ripgrep/Git/EventV2/EventV2Bridge/InstanceStore/httpClient/Credential/ModelsDev/Npm/LLM。
- [ ] **S8 删除实现目录（外围）**：skill、mcp、memory、indexing、sandbox、worktree、question、permission、installation、share、control-plane、background、lsp、plugin（确认 LLM 不依赖后）等。
- [ ] **S9 清理 TUI / CLI 命令 / 启动入口**：`packages/opencode/src/tui/`、`cli/tui/`、`cli/cmd` 中非 serve 命令、`server/shared/ui` 等。
- [ ] **S10 清理构建配置 / 脚本 / 测试**：esbuild、knip、package.json、无用脚本与测试。

**UX 决策（2026-08-15 确认）**：设置页不新增三字段表单。最小配置（Base URL / API Key / Model）由现有 `CustomProviderDialog` 流程提供，提交信息经 `CommitMessageTab` 选择该 provider 的模型（`commit_message.model = {id}@<model>`）；补全保持内置 FIM provider 目录（FIM 格式各厂商不通用，不接自定义）。

## 阶段 7：移除 Kilo 云服务、账号、Gateway 和遥测

### 前置条件

提交信息需可经自定义 OpenAI 兼容 provider 独立调用（不依赖 Kilo Gateway）；补全需确认 BYOK 内置 FIM provider 可独立工作后，再移除 Gateway。

### 主要范围

重点调查和移除：

```text
packages/kilo-gateway/
packages/kilo-telemetry/
packages/kilo-vscode/src/services/telemetry/
```

同时清理：

- 登录和设备授权。
- Profile、余额、团队、订阅。
- Gateway Provider 和 OpenRouter 路由。
- 云会话和 URI 深链接。
- PostHog 和 OpenTelemetry 初始化。
- 遥测设置、事件名和捕获调用。
- Kilo 云端环境变量和依赖。

### 风险

不能仅从 workspace 删除包；必须先确认 `packages/opencode`、扩展和其他构建脚本已无引用。遥测调用散布范围可能较广，建议先移除运行时实现，再清理调用点。

### 验收

- 扩展不发起任何 Kilo 云服务请求。
- 不显示登录、Profile、余额或团队入口。
- 不初始化 PostHog 或 OpenTelemetry。
- OpenAI 兼容接口仍独立可用。

### 阶段 7.1：移除遥测（2026-08-15 执行）

> 本小节独立于阶段 7 其余云服务/账号/Gateway 移除，先单独完成「遥测」这一功能组。

**方案确认（2026-08-15，用户选择）**：

1. **PostHog + OpenTelemetry 都移除**：删除 `packages/kilo-telemetry/` 包、CLI `/telemetry` HTTP 路由、VS Code `src/services/telemetry/`（TelemetryProxy），以及 AI SDK 的 OpenTelemetry 接线（`agent.ts` 的 `experimental_telemetry` + `@effect/opentelemetry` import、`llm.ts` 的 `experimental_telemetry: { isEnabled: false }`、`kilocode/agent/index.ts` 的 `telemetryOptions`）。
2. **重新生成 SDK**：删除 CLI 侧 `/telemetry` 路由后运行 `bun ./script/generate.ts`，清除 `openapi.json` / `sdk.gen.ts` 中的 telemetry 客户端。
3. **一并移除补全遥测**：删除 `AutocompleteTelemetry` 类及其在补全路径中的调用点（captureAcceptSuggestion / captureCacheHit 等），只保留补全逻辑本身。

**任务清单**：

- [x] T1 删除 `packages/kilo-telemetry/` 包目录，清理 `packages/opencode/package.json` 与 `bun.lock` 依赖。
- [x] T2 移除 CLI 侧遥测调用点：
  - `src/kilocode/cli/setup.ts`（Telemetry.init/trackCliStart/trackCliExit/shutdown/flushInBackground）。
  - `src/kilocode/bootstrap.ts`（Identity 仅供 session-export anonId，需内联机器 ID 逻辑）。
  - `src/auth/index.ts`（updateIdentity / trackAuthLogout）。
  - `src/provider/auth.ts`（updateIdentity / trackAuthSuccess）。
  - `src/session/llm/request.ts`（Identity import，确认用途后移除）。
  - `src/kilocode/indexing.ts`、`src/kilocode/suggestion/index.ts`、`src/kilocode/plan-followup.ts`、`src/kilocode/session/processor.ts`、`src/kilocode/review/command.ts`、`src/kilocode/tool/chart.ts`、`src/tool/warpgrep.ts`、`src/kilocode/cli/cmd/tui/feedback.ts` 的 track*/ReviewCommand 引用。
- [x] T3 移除 CLI HTTP `/telemetry` 路由：删除 `handlers/telemetry.ts`、`groups/telemetry.ts`，从 `api.ts`、`server.ts` 移除 `TelemetryApi`/`telemetryHandlers` 注册。
- [x] T4 移除 OpenTelemetry 接线：`agent.ts` 的 `experimental_telemetry` + `OtelTracer` import、`llm.ts` 的 `experimental_telemetry`、`kilocode/agent/index.ts` 的 `telemetryOptions`。`@effect/opentelemetry` 依赖保留（上游 `packages/core/src/observability/otlp.ts` 使用）。
- [x] T5 移除 VS Code 侧 telemetry：删除 `src/services/telemetry/` 目录；清理 `extension.ts` 的 TelemetryProxy 接线、`agent-manager/fork-session.ts`、补全服务中的 `AutocompleteTelemetry` 及 `TelemetryProxy.capture` 调用、`server-manager.ts` 的 `KILO_TELEMETRY_LEVEL` env、`AboutKiloCodeTab` 遥测 UI 与 i18n 文案、webview 消息类型。
- [ ] T6 重新生成 SDK：`bun ./script/generate.ts` 清除 telemetry 客户端（脚本含 SDK 构建 + `bun dev generate`，按用户「不构建验证」指令待确认后运行）。
- [x] T7 清理测试与文档：删除引用 kilo-telemetry / telemetry 路由的 CLI 测试与 VS Code 测试。

**进度**：

- 2026-08-15：完成方案确认，写入本计划。
- 2026-08-15（本轮，**中间态，未构建验证**）：完成 T1 与 T2 大部分，用户叫停，遗留代码与断裂点如下。

  **已完成**：
  - `packages/kilo-telemetry/` 包目录已删除；`packages/opencode/package.json`、`bun.lock`（待下次 `bun install` 收敛）、`script/upstream/utils/config.ts`、`script/upstream/transforms/transform-package-json.ts`、`script/upstream/README.md`、`packages/kilo-vscode/script/prepare-sdk.ts` 中的 kilo-telemetry 引用已清理。
  - CLI 侧遥测调用点已移除：`setup.ts`（Telemetry.init/trackCliStart/trackCliExit/shutdown/flushInBackground + `cfg`/`Config`）、`auth/index.ts`（updateIdentity/trackAuthLogout）、`provider/auth.ts`（updateIdentity/trackAuthSuccess）、`session/llm/request.ts`（Identity + HEADER_MACHINEID 请求头）、`indexing.ts`（trackTelemetry 函数删除，worker `telemetry` 回调保留为空操作）、`suggestion/index.ts`（trackSuggestionShown/Accepted）、`plan-followup.ts`（trackPlanFollowup）、`tool/chart.ts`、`tool/warpgrep.ts`（trackToolUsed）、`tui/feedback.ts`（文件删除，`submitFeedback` 无调用点）。
  - ReviewTelemetry 标记链路已移除：`kilocode/session/processor.ts`（ReviewTelemetry 类型、reviewTelemetry/markReviewTelemetry/extractReviewTelemetry/suggestionReviewTelemetry/extractSuggestionReviewTelemetry/trackStep 全部删除）、共享 `session/processor.ts`（Input.telemetry、ctx.telemetry、trackStep 调用）、共享 `session/prompt.ts`（extractReviewTelemetry/extractSuggestionReviewTelemetry、`telemetry` 传参、markReviewTelemetry）、共享 `tool/task.ts`（markReviewTelemetry）。`review/command.ts` 的 `ReviewCommand` 类型改为本地 `"review"` 字面量。
  - `bootstrap.ts` 的 session-export anonId 已解除对 `Identity` 的依赖，改为内联读取 `telemetry-id` 文件（遗留文件，不再创建）。

  **遗留（下一步继续，已确认引用点但未改）**：
  - **T3 HTTP 路由（当前代码已断裂）**：`handlers/telemetry.ts` 与 `groups/telemetry.ts` 已删除文件，但 `api.ts:45`（import TelemetryApi）与 `api.ts:114`（addHttpApi(TelemetryApi)）、`server.ts:29`（import telemetryHandlers）与 `server.ts:49`（telemetryHandlers 注册）仍引用已删文件——**这是当前唯一的编译断裂点**。
  - T4 OpenTelemetry 接线：`agent.ts` 的 `experimental_telemetry: KiloAgent.telemetryOptions(cfg)` + `OtelTracer` import（死 import）、`llm.ts` 的 `experimental_telemetry: { isEnabled: false }`、`kilocode/agent/index.ts` 的 `telemetryOptions`。**注意**：`packages/core/src/observability/otlp.ts` 是上游 observability 基础设施（无 kilocode 标记），使用 `@effect/opentelemetry` / `@opentelemetry/*` 依赖，**不在移除范围**，对应依赖不能删。
  - T5 VS Code 侧 telemetry：`src/services/telemetry/` 目录、`extension.ts`（TelemetryProxy 接线 + deactivate）、`agent-manager/fork-session.ts`、补全服务 `AutocompleteTelemetry`/`TelemetryProxy.capture`、`server-manager.ts` 的 `KILO_TELEMETRY_LEVEL` env、`AboutKiloCodeTab` 遥测 UI、i18n `settings.aboutKiloCode.telemetry.*` 文案、webview 消息类型（TelemetryStateMessage/TelemetryRequest）。
  - T6 SDK 重新生成：`bun ./script/generate.ts` 清除 openapi.json / sdk.gen.ts 的 telemetry 客户端（在 T3 完成、断裂点修复后再跑）。
  - T7 测试清理：CLI 测试（`test/kilocode/cli-shutdown.test.ts`、`test/session/prompt.test.ts`、`test/kilocode/plan-followup.test.ts`、`test/kilocode/suggestion/suggestion.test.ts`、`test/kilocode/telemetry/feedback.test.ts`、`test/kilocode/server/httpapi-public.test.ts`、`test/kilocode/server/httpapi-exercise-scenarios.ts` 等）与 VS Code 测试。

- 2026-08-15（本轮，**完成 T3–T5 与 T7，仅剩 T6 待确认**）：完成以下收尾，未做构建验证（按用户指示）。

  **T3 已完成**：`handlers/telemetry.ts` / `groups/telemetry.ts` 已删；`api.ts` 移除 `TelemetryApi` import（原 45 行）与 `.addHttpApi(TelemetryApi)`（原 114 行）；`server.ts` 移除 `telemetryHandlers` import（原 29 行）与注册（原 49 行）。全仓 grep 无 `TelemetryApi`/`telemetryHandlers`/`groups/telemetry`/`handlers/telemetry` 残留。
  **T4 已完成**：`agent.ts` 删除 `import * as OtelTracer` 死 import 与 `experimental_telemetry: KiloAgent.telemetryOptions(cfg)` 块；`llm.ts` 删除 `experimental_telemetry: { isEnabled: false }` 块；`kilocode/agent/index.ts` 删除 `telemetryOptions` 函数。`@effect/opentelemetry` 依赖保留（`packages/core/src/observability/otlp.ts` 上游使用）。`agent.ts` 的 `KiloAgent` import 仍被 `prepare/patchAgents` 等使用，保留。
  **T5 已完成**：删除 `src/services/telemetry/` 目录（5 文件）。`extension.ts` 移除 TelemetryProxy 接线、`onDidChangeTelemetryEnabled` 订阅与 `deactivate()`；`agent-manager/fork-session.ts` 移除 TelemetryProxy.capture 与 `PLATFORM` 常量；`server-manager.ts` 移除 `KILO_TELEMETRY_LEVEL` env；`connection-service.ts`/`utils.ts`/`SettingsProvider.ts` 更新 telemetry 注释。补全 telemetry：`AutocompleteServiceManager.ts` 移除 TelemetryProxy/AutocompleteTelemetry import、onSuggestion 回调、GHOST_SERVICE_DISABLED 与 INLINE_ASSIST_AUTO_TASK capture 及 taskId/crypto；`AutocompleteInlineCompletionProvider.ts` 移除 telemetry 字段/构造参数/全部 `telemetry?.` 调用与 `lastSuggestion`/`telemetryContext`；`NextEditInlineCompletionProvider.ts` 移除 onSuggestion 选项、`NextEditSuggestionEvent` 类型、`emitNotShown` 方法与 5 处调用；删除 `AutocompleteTelemetry.ts`、`telemetry-utils.ts`、死代码 `chat-autocomplete/` 目录；`types.ts` 删除无引用的 `LastSuggestionInfo`。webview：`AboutKiloCodeTab.tsx` 删除 Telemetry 区块与 `Icon` import；`webview-messages.ts` 删除 `TelemetryRequest`、`extension-messages.ts` 删除 `TelemetryStateMessage` 及联合类型成员；21 个 i18n 文件删除 `settings.aboutKiloCode.telemetry.*` 文案（括号平衡校验通过）。
  **T7 已完成**：VS Code 侧删除 `autocomplete-telemetry-utils.test.ts`/`telemetry-errors.test.ts`/`telemetry-proxy-utils.test.ts`，`vscode-mock.ts` 移除 `isTelemetryEnabled`，`AutocompleteServiceManager.spec.ts` 移除 `AutocompleteTelemetry` 与 `@roo-code/telemetry` mock。CLI 侧删除 `telemetry/feedback.test.ts`、`session-processor-review-telemetry.test.ts`；`cli-shutdown.test.ts` 移除 kilo-telemetry mock 并更新断言为 `["session","dispose"]`；`prompt.test.ts` 删除 2 个 review-telemetry 测试块与 import；`plan-followup.test.ts` 删除 trackPlanFollowup spy 与断言；`suggestion.test.ts` 删除 6 个 telemetry 测试块与 import；`httpapi-public.test.ts` 删除 TelemetryPaths import 与 2 条路由；`httpapi-exercise-scenarios.ts` 删除 2 个 telemetry 场景。文档：`kilo-vscode/AGENTS.md` 与根 `CLAUDE.md` 删除 kilo-telemetry 包行。
  **T6 待确认**：SDK 生成物（`openapi.json` `/telemetry/*`、`sdk.gen.ts` `Telemetry` 类、`types.gen.ts` `Telemetry*` 类型）仍含 telemetry 客户端。运行 `bun ./script/generate.ts` 含 SDK 构建与 `bun dev generate`，按用户「不进行构建验证」指令，待用户确认后再运行。

## 阶段 8：最小化 CLI 后端（保留核心，只删外围）

### 前置条件

阶段 6（配置/调用层）与阶段 7（移除云服务、账号、Gateway、遥测）完成。

### 方案说明（2026-08-15 已确认方案 B）

本阶段**不删除** CLI 后端。保留 `kilo serve` 子进程、SDK/HTTP 客户端、CLI 二进制打包与 `packages/opencode` 核心（Provider/LLM/Session/Agent/Config/Auth/Storage）。只从 CLI 剥离外围模块。

### 剥离范围

按阶段 6「方案 B 执行记录」S5–S10 分批执行：

- Kilo 特有 handler：agentBuilder、anacondaDesktop、backgroundProcess、branchName、enhancePrompt、indexing、instanceReload、interactiveTerminal、memory、network、sandbox、sessionImport、suggestion、telemetry。
- 共享路由组：experimental、mcp、permission、question、session、sync、tui、pty、project、projectCopy、workspace、control、controlPlane、file。
- 服务节点与实现目录：skill、mcp、memory、indexing、sandbox、worktree、question、permission、installation、share、control-plane、background、lsp、plugin 等（逐一确认 LLM/Provider/Session 不依赖后再删）。
- TUI、CLI 非 serve 命令、`server/shared/ui`。

### 保留

- `packages/opencode`、`packages/sdk/js`、`packages/plugin`、`packages/kilo-memory`（按最终依赖确认）。
- `KiloConnectionService`、`ServerManager`、HTTP/SSE 客户端、CLI 二进制打包脚本。

### 多 Provider 清理

删除与补全（内置 FIM provider）和提交信息（自定义 OpenAI 兼容 provider）无关的 Provider 目录、模型目录和认证方式。

### 验收

- 扩展仍启动 `kilo serve` 子进程（方案 B 保留）。
- 安装包仍包含 CLI 二进制。
- CLI 服务端不再注册被剥离的路由组与服务。
- 提交信息经自定义 OpenAI 兼容 provider 工作；补全经内置 FIM provider 工作。
- CLI 体积与依赖显著缩减。

## 阶段 9：删除非目标产品和开发基础设施

### 候选范围

在确认不被最终扩展构建引用后，移除：

- JetBrains 插件。
- 文档站。
- Storybook 和截图故事。
- Stats 或其他内部应用。
- CLI/TUI 专用脚本。
- 上游同步专用脚本和检查。
- 与已删除包对应的 patches。
- 无用 GitHub Workflows。
- 无用 Changeset、发布和安装脚本。
- 无用根依赖和 workspace catalog 项。

### 注意

GitHub Workflow 的删除需要同步维护仓库现有工作流 allowlist。最终若完全移除相关检查，也应明确删除对应脚本和 CI 调用，而不是只让检查失效。

### 验收

- 根 workspace 只包含最终扩展和确有需要的共享包。
- 根脚本只服务最终产品的开发、检查和打包。
- lockfile 中不再保留已删除工作区带来的无用依赖。

## 阶段 10：最终清理和产品收口

### 工作内容

- 重命名产品名称、命令前缀和配置前缀（如需要）。
- 更新扩展名称、描述、关键词、图标和 README。
- 删除失效的多语言文案。
- 删除失效资源和构建产物规则。
- 清理无用依赖、patches 和 trustedDependencies。
- 清理死代码、未使用导出和过期测试。
- 明确 OpenAI 兼容范围及不保证兼容的扩展字段。
- 补充用户配置和接口对接说明。

### 最终验收

- 全新安装后，只需填写 Base URL、API Key、Model 即可使用。
- 编辑器代码补全可用。
- Git 提交信息生成可用。
- 不出现聊天、Agent、Marketplace、账号、云服务或遥测入口。
- 扩展不启动无关子进程。
- 扩展不访问 Kilo 服务。
- API Key 安全存储且不会输出到日志。

## 6. 不建议优先删除的模块

以下模块虽然最终可能删除，但不能在前期直接动手：

### `packages/opencode/`

当前提交信息生成直接依赖其中的 Provider、LLM 和 HTTP 服务，补全也依赖 CLI 后端。

### `packages/sdk/js/`

当前 VS Code 扩展通过 SDK 调用 CLI 接口。

### `packages/kilo-vscode/src/services/cli-backend/`

当前两项保留功能都依赖共享连接服务。

### 设置界面

设置页保持现状（2026-08-15 确认），作为 Base URL、API Key、Model 的配置入口，不新增三字段表单。

### `packages/kilo-gateway/`

虽然最终不需要 Kilo Gateway，但当前补全 Provider 设置和默认模型路径可能仍依赖它。应先替换调用链，再删除。

### `packages/kilo-ui/`

在所有 Webview 删除或最小设置页改造完成前，不能直接删除共享 UI 包。

## 7. 每阶段统一执行模板

每次裁剪一个模块时，按以下顺序处理：

1. 查明模块的用户入口、运行时入口和依赖。
2. 确认代码补全和提交信息不依赖该模块。
3. 删除 `package.json` 中的命令、菜单、快捷键和配置项。
4. 删除 `extension.ts` 等激活入口中的初始化和注册。
5. 删除 Serializer、后台监听、状态恢复和网络连接。
6. 删除构建入口、TypeScript include 和 Knip 配置。
7. 删除实现目录。
8. 调整只针对该模块的测试和架构约束。
9. 搜索残留符号、命令 ID、资源名和环境变量。
10. 由用户人工验证代码补全和 Git 提交信息。
11. 用户确认后再进入下一阶段。

## 8. 人工验证清单

按照当前要求，不执行构建验证。每阶段完成后至少人工确认以下内容。

### 代码补全

- [ ] 自动触发行内补全可用
- [ ] 手动触发补全命令可用
- [ ] 接受和取消建议可用
- [ ] 切换文件后补全仍可用
- [ ] 请求可以取消，不持续占用连接
- [ ] 使用的是用户配置的模型

### Git 提交信息

- [ ] Source Control 中生成按钮存在
- [ ] 有变更时可生成提交信息
- [ ] 结果写入正确仓库的 Git 输入框
- [ ] 无变更时给出合理提示
- [ ] 多仓库工作区选择正确
- [ ] 使用的是用户配置的模型

### 配置与安全

- [ ] Base URL 可保存和读取
- [ ] Model 可保存和读取
- [ ] API Key 保存到 CLI auth store，不出现于 `settings.json`
- [ ] 日志中不出现 API Key
- [ ] 错误提示不泄漏请求头
- [ ] 不向 Kilo 云服务发送请求

### 被移除功能

- [ ] UI 中不再出现入口
- [ ] 命令面板中不再出现命令
- [ ] 重启后不恢复旧面板
- [ ] 扩展启动时不初始化对应服务
- [ ] 不再发起对应网络请求
- [ ] 不存在失效快捷键或菜单

## 9. 风险控制

### 9.1 当前工作区已有修改

当前已知存在用户未提交修改：

```text
bun.lock
packages/opencode/package.json
```

此外，`REPOSITORY_REDUCTION_PLAN.md` 在本次对话开始时已是未跟踪文件。本文件曾被误覆盖，原内容无法从当前工作树恢复。后续修改不得覆盖或回退其他用户工作。

### 9.2 删除共享代码的风险

一个模块被某个待删除功能使用，不代表它只服务该功能。删除共享类型、资源、组件和工具前必须全仓搜索引用。

### 9.3 配置迁移风险

旧设置中可能存在 Kilo Provider、Gateway 和自动补全模型配置。最终配置收缩时，应明确是迁移已有 OpenAI 配置还是要求用户重新配置，不能隐式猜测。

### 9.4 OpenAI 兼容性差异

不同服务虽然声称兼容 OpenAI，但可能在以下方面不同：

- Endpoint 路径。
- Chat Completions 与 Responses API 支持情况。
- 流式响应格式。
- 自定义模型名称。
- FIM 参数或补全接口支持情况。
- 超时、错误体和 token 限制。

实现前应确定最小兼容协议，不应假设所有 OpenAI 风格服务行为完全一致。

### 9.5 代码补全模型能力

普通 Chat Completions 模型不一定支持 FIM。**2026-08-15 已确认**：代码补全保持内置 FIM provider 目录（kilo/mistral/inception/deepseek/alibaba-cn），不接自定义 baseUrl——FIM 各厂商适配格式不通用（Mistral `/v1/fim/completions` prefix/suffix、DeepSeek `/beta/completions`、DashScope `<|fim_prefix|>` 模板等），无法用统一格式适配任意 OpenAI 兼容接口。补全模型由用户从内置目录选择。

## 10. 推荐执行结论

推荐按以下顺序推进：

1. 建立保留功能基线。
2. 移除 KiloClaw。
3. 移除 Marketplace。
4. 移除 Agent Manager 和 worktree。
5. 分批移除 Browser Automation、Notebook、Remote、Diff、Sub-agent、自动审批等外围能力。
6. 使用现有设置页自定义 provider 流程配置 Base URL / API Key / Model（不新增三字段表单）。
7. 提交信息经 CLI Provider/LLM 调用自定义 OpenAI 兼容 provider；补全保持内置 FIM。
8. 移除普通 Agent Chat 和主 Webview。
9. 移除账号、云服务、Gateway 和遥测。
10. 最小化 CLI 后端：保留核心（LLM/Provider/Session/Agent），只删外围（TUI、云 handler、索引/记忆/sandbox/mcp 等）。
11. 删除非目标产品、无用 workspace、脚本、CI 和依赖。
12. 完成产品命名、文档和打包收口。

第一批仍建议从 **KiloClaw** 开始，但它只是总裁剪路线图中的第一项，不是整个计划本身。
