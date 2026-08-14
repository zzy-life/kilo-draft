import { expect, test } from "bun:test"

// client.ts binds window.fetch once at import time, so every test must share the
// same window whose fetch writes into a swappable calls array.
let calls: Array<{ url: string; method: string; body: unknown }> = []

const win = {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init)
    calls.push({ url: req.url, method: req.method, body: await req.json() })
    return new Response(JSON.stringify({ permission: { edit: { "*": "allow" } } }), {
      headers: { "content-type": "application/json" },
    })
  },
}

function setup() {
  calls = []
  Object.defineProperty(globalThis, "window", { value: win, configurable: true })
  return calls
}

test("config writes include the selected directory", async () => {
  const calls = setup()
  const client = await import("./client")
  const query = { url: "http://kilo:secret@127.0.0.1:4097", dir: "/tmp/project", scope: "project" as const }

  await client.saveConfig(query, { permission: { edit: { "*": "allow" } } })
  await client.unsetConfig(query, [["permission", "edit"]])
  await client.patchConfig(query, { indexing: { provider: "ollama" } }, [["indexing", "model"]])

  expect(calls).toHaveLength(3)

  const save = calls[0]
  const unset = calls[1]
  const patch = calls[2]
  expect(save.method).toBe("PATCH")
  expect(new URL(save.url).searchParams.get("directory")).toBe("/tmp/project")
  expect(save.body).toEqual({ scope: "project", set: { permission: { edit: { "*": "allow" } } } })

  expect(unset.method).toBe("PATCH")
  expect(new URL(unset.url).searchParams.get("directory")).toBe("/tmp/project")
  expect(unset.body).toEqual({ scope: "project", unset: [["permission", "edit"]] })

  expect(patch.method).toBe("PATCH")
  expect(new URL(patch.url).searchParams.get("directory")).toBe("/tmp/project")
  expect(patch.body).toEqual({
    scope: "project",
    set: { indexing: { provider: "ollama" } },
    unset: [["indexing", "model"]],
  })
})

