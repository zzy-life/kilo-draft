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

- Activity Bar 中不再有聊天侧栏。
- 扩展激活不再创建 `KiloProvider`。
- 不再有 Session、Agent、Tool 或 Permission 交互。
- OpenAI 配置入口仍可用。
- 两项保留功能正常。

## 阶段 6：建立最小 OpenAI 兼容配置与调用层

### 原因

前几阶段主要删除 UI 叶子功能。本阶段开始替换共享核心，是整个裁剪中最关键的一步。

### 最小配置

建议只保留：

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

### 配置存储建议

- Base URL、Model 和普通开关：VS Code Configuration。
- API Key：VS Code `SecretStorage`，不应明文写入 `settings.json`。
- 明确全局和工作区配置的优先级。
- 默认不猜测第三方接口路径；根据 OpenAI 兼容协议明确使用的 endpoint。

### 调用层选择

在实施前需要人工确认以下架构选择：

#### 方案 A：扩展直接调用 OpenAI 兼容接口

优点：

- 最终结构最小。
- 可以删除 CLI 子进程、HTTP/SSE、SDK 和大量 Provider 代码。
- 代码补全和提交信息都在扩展内完成。

缺点：

- 需要把补全上下文构建和提交信息 Prompt 调用迁到扩展侧。
- 需要自行实现请求取消、超时、错误处理和流式解析。

#### 方案 B：保留最小 CLI 后端

优点：

- 可以复用现有提交信息和部分补全逻辑。
- 扩展侧改动相对较小。

缺点：

- 仍需打包 CLI 二进制、启动子进程并维护 SDK/HTTP。
- 最终仓库和安装包仍然较重。
- 需要从庞大的 CLI 中剥离 Agent、工具、Session、Provider、TUI 等模块。

### 推荐

若目标是“只保留代码补全和 Git 提交信息”的真正轻量扩展，推荐最终采用**方案 A：扩展直接调用 OpenAI 兼容接口**。

在方案 A 完成并人工确认之前，不要删除旧 CLI 调用链。可先让新调用层同时服务补全和提交信息，再移除旧后端。

### 验收

- 用户只需配置 Base URL、API Key 和 Model。
- 两项功能均通过同一个 OpenAI 兼容客户端工作。
- 不再依赖 Kilo 账号或 Gateway 才能调用模型。
- 请求支持取消和合理超时。
- API Key 不出现在日志、错误信息或普通设置文件中。

## 阶段 7：移除 Kilo 云服务、账号、Gateway 和遥测

### 前置条件

只有当阶段 6 的 OpenAI 兼容调用链已经完全独立后才能开始。

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

## 阶段 8：移除 CLI、SDK 和多 Provider 核心

### 前置条件

扩展已经直接完成代码补全和 Git 提交信息生成，不再调用 `KiloConnectionService`。

### 扩展侧清理

移除：

```text
packages/kilo-vscode/src/services/cli-backend/
```

同步清理：

- `KiloConnectionService`。
- `ServerManager`。
- HTTP/SSE 客户端。
- CLI 二进制打包和复制脚本。
- 后端预热逻辑。
- CLI 密码和端口管理。

### 仓库包清理

根据最终引用关系评估删除：

```text
packages/opencode/
packages/sdk/js/
packages/plugin/
packages/kilo-memory/
packages/core/
```

不要把上面的列表理解为必删清单。每个包都必须根据 workspace 引用和最终扩展依赖确认。

### 多 Provider 清理

删除所有与最终 OpenAI 兼容客户端无关的 Provider SDK、模型目录、认证方式、Provider 配置和补丁。

### 验收

- 扩展不再启动 `kilo serve` 子进程。
- 安装包不再包含 CLI 二进制。
- 不再依赖自动生成 SDK。
- 不再包含多 Provider 模型选择逻辑。
- 两项功能直接调用用户配置的 OpenAI 兼容接口。

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

新的 Base URL、API Key 和 Model 配置入口落地前，必须暂时保留。

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
- [ ] API Key 使用 SecretStorage
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

普通 Chat Completions 模型不一定支持 FIM。最终需要明确代码补全采用：

- Chat Prompt 生成后续代码；
- FIM Prompt；或
- 服务商专用代码补全接口。

该决策会影响“任意 OpenAI 兼容 Base URL”的实际兼容范围，应在阶段 6 由用户确认。

## 10. 推荐执行结论

推荐按以下顺序推进：

1. 建立保留功能基线。
2. 移除 KiloClaw。
3. 移除 Marketplace。
4. 移除 Agent Manager 和 worktree。
5. 分批移除 Browser Automation、Notebook、Remote、Diff、Sub-agent、自动审批等外围能力。
6. 建立最小 OpenAI 配置入口。
7. 让代码补全和提交信息直接使用统一 OpenAI 兼容客户端。
8. 移除普通 Agent Chat 和主 Webview。
9. 移除账号、云服务、Gateway 和遥测。
10. 移除 CLI 后端、SDK 和多 Provider 核心。
11. 删除非目标产品、无用 workspace、脚本、CI 和依赖。
12. 完成产品命名、文档和打包收口。

第一批仍建议从 **KiloClaw** 开始，但它只是总裁剪路线图中的第一项，不是整个计划本身。
