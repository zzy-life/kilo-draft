import { GitOps } from "../agent-manager/GitOps"

async function resolve(git: GitOps, dir?: string): Promise<{ directory: string; baseBranch: string } | undefined> {
  if (!dir) return undefined
  const branch = await git.currentBranch(dir)
  if (!branch || branch === "HEAD") return undefined
  const tracking = await git.resolveTrackingBranch(dir, branch)
  const fallback = tracking ? undefined : await git.resolveDefaultBranch(dir, branch)
  return { directory: dir, baseBranch: tracking || fallback || "HEAD" }
}

let shared: GitOps | undefined

function ops(): GitOps {
  if (shared && !shared.disposed) return shared
  shared = new GitOps({ log: () => undefined })
  return shared
}

export function disposeGitChangesTarget(): void {
  shared?.dispose()
  shared = undefined
}

export async function resolveGitChangesTarget(message: Record<string, unknown>, dir: string) {
  if (message.type !== "requestGitChangesContext") return message
  if (typeof message.contextDirectory === "string" || typeof message.gitChangesBase === "string") return message

  const target = await resolve(ops(), dir)
  if (!target) return { ...message, contextDirectory: dir }
  return { ...message, contextDirectory: target.directory, gitChangesBase: target.baseBranch }
}
