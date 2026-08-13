import * as vscode from "vscode"
import type { KiloConnectionService } from "../cli-backend/connection-service"
import { getErrorMessage } from "../../kilo-provider-utils"
import { getCommitMessageLanguage } from "../i18n"

let lastGeneratedMessage: string | undefined
let lastWorkspacePath: string | undefined

interface GitRepository {
  inputBox: { value: string }
  rootUri: vscode.Uri
}

interface GitAPI {
  repositories: GitRepository[]
}

interface GitExtensionExports {
  getAPI(version: number): GitAPI
}

function findRepository(repositories: GitRepository[], arg?: vscode.SourceControl): GitRepository | undefined {
  if (!repositories.length) return undefined
  if (arg?.rootUri) {
    const target = arg.rootUri.fsPath
    const match = repositories.find((r) => r.rootUri.fsPath === target)
    if (match) return match
  }
  return repositories[0]
}

export function registerCommitMessageService(
  context: vscode.ExtensionContext,
  connectionService: KiloConnectionService,
): vscode.Disposable[] {
  let active: { controller: AbortController; cancelled: boolean } | undefined

  const command = vscode.commands.registerCommand(
    "kilo-code.new.generateCommitMessage",
    async (arg?: vscode.SourceControl) => {
      if (active) return

      const extension = vscode.extensions.getExtension<GitExtensionExports>("vscode.git")
      if (!extension) {
        vscode.window.showErrorMessage("Git extension not found")
        return
      }

      if (!extension.isActive) {
        await extension.activate()
      }

      const git = extension.exports?.getAPI(1)
      const repository = findRepository(git?.repositories ?? [], arg)
      if (!repository) {
        vscode.window.showErrorMessage("No Git repository found")
        return
      }

      const path = repository.rootUri.fsPath
      const state = { controller: new AbortController(), cancelled: false }
      active = state
      await vscode.commands.executeCommand("setContext", "kilo-code.new.commitMessageGenerating", true)

      try {
        let client
        try {
          client = await connectionService.getClientAsync(path)
        } catch (err) {
          if (state.cancelled) return
          console.error("[Kilo New] Failed to connect to Kilo backend:", err)
          vscode.window.showErrorMessage("Failed to connect to Kilo backend. Please try again.")
          return
        }
        if (state.cancelled) return

        const previousMessage = lastWorkspacePath === path ? lastGeneratedMessage : undefined
        let timedOut = false

        await vscode.window
          .withProgress(
            {
              location: vscode.ProgressLocation.SourceControl,
              title: "Generating commit message...",
              cancellable: true,
            },
            async (_progress, token) => {
              // Wire VS Code cancellation to abort the HTTP request
              token.onCancellationRequested(() => {
                state.cancelled = true
                state.controller.abort()
              })

              // Client-side safety timeout (35s) — slightly longer than the
              // server-side 30s timeout so the server can respond with a proper
              // error first, but still ensures the spinner never hangs forever.
              const timeout = 35_000
              const timer = setTimeout(() => {
                timedOut = true
                state.controller.abort()
              }, timeout)

              try {
                const { data } = await client.commitMessage.generate(
                  { path, selectedFiles: undefined, previousMessage, language: getCommitMessageLanguage(vscode) },
                  { throwOnError: true, signal: state.controller.signal },
                )
                const message = data.message
                repository.inputBox.value = message
                lastGeneratedMessage = message
                lastWorkspacePath = path
                console.log("[Kilo New] Commit message generated successfully")
              } finally {
                clearTimeout(timer)
              }
            },
          )
          .then(undefined, (error: unknown) => {
            if (state.cancelled) {
              console.log("[Kilo New] Commit message generation was cancelled by user")
              return
            }
            if (timedOut) {
              console.log("[Kilo New] Commit message generation timed out")
              vscode.window.showErrorMessage("Commit message generation timed out. Please try again.")
              return
            }
            const msg = getErrorMessage(error)
            console.error("[Kilo New] Failed to generate commit message:", msg)
            vscode.window.showErrorMessage(msg || "Failed to generate commit message. Please try again.")
          })
      } finally {
        if (active === state) active = undefined
        await vscode.commands.executeCommand("setContext", "kilo-code.new.commitMessageGenerating", false)
      }
    },
  )

  const pause = vscode.commands.registerCommand("kilo-code.new.pauseCommitMessageGeneration", () => {
    if (!active) return
    active.cancelled = true
    active.controller.abort()
  })

  context.subscriptions.push(command, pause)
  return [command, pause]
}
