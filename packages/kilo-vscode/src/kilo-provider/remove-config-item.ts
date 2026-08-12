import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"
import type { KiloConnectionService } from "../services/cli-backend"

export interface RemoveConfigItemContext {
  connection: KiloConnectionService
  project: () => string | undefined
  directory: () => string
  refresh: () => Promise<void>
  storage?: vscode.Uri
}

export async function removeMcp(ctx: RemoveConfigItemContext, name: string): Promise<boolean> {
  const project = ctx.project()
  const files = [
    ...(project
      ? [
          path.join(project, ".kilo", "kilo.json"),
          path.join(project, ".kilo", "mcp.json"),
          path.join(project, ".kilocode", "mcp.json"),
        ]
      : []),
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "kilo", "kilo.json"),
  ]

  if (ctx.storage) files.push(path.join(ctx.storage.fsPath, "settings", "mcp_settings.json"))

  let removed = false
  for (const file of files) {
    const changed = await removeMcpFromFile(file, name)
    removed ||= changed
  }

  if (!removed) return false
  await invalidate(ctx)
  await ctx.refresh()
  return true
}

async function removeMcpFromFile(file: string, name: string): Promise<boolean> {
  try {
    const uri = vscode.Uri.file(file)
    const bytes = await vscode.workspace.fs.readFile(uri)
    const config = JSON.parse(Buffer.from(bytes).toString("utf8")) as Record<string, Record<string, unknown>>
    const section = config.mcp?.[name] ? config.mcp : config.mcpServers?.[name] ? config.mcpServers : undefined
    if (!section) return false

    delete section[name]
    if (Object.keys(section).length === 0) {
      if (section === config.mcp) delete config.mcp
      else delete config.mcpServers
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(config, null, 2), "utf8"))
    return true
  } catch {
    return false
  }
}

async function invalidate(ctx: RemoveConfigItemContext): Promise<void> {
  const client = await ctx.connection.getClientAsync(ctx.directory()).catch(() => null)
  if (!client) return

  await client.global.config.update({ config: {} }).catch(() => {})
  await client.instance.dispose({ directory: ctx.directory() }).catch(() => {})
}
