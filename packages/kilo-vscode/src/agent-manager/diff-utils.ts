import { createReadStream } from "fs"
import * as fs from "fs/promises"
import * as path from "path"

const SAMPLE_BYTES = 8_192
const MAX_IMAGE_BYTES = 5_000_000

const MIMES: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpe": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
}

export type DiffImageSide = {
  mime: string
  bytes: number
  data?: string
  error?: "too-large" | "unreadable"
}

export type DiffImage = {
  before?: DiffImageSide
  after?: DiffImageSide
}

type ImageSource = {
  bytes: number
  read: () => Promise<Buffer | undefined>
}

function binary(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false
  let controls = 0
  for (const byte of bytes) {
    if (byte === 0) return true
    if (byte < 9 || (byte > 13 && byte < 32)) controls++
  }
  return controls / bytes.length > 0.3
}

export async function binaryFile(file: string): Promise<boolean> {
  const stat = await fs.lstat(file).catch(() => undefined)
  if (!stat?.isFile()) return false
  const handle = await fs.open(file, "r").catch(() => undefined)
  if (!handle) return false
  const sample = Buffer.alloc(SAMPLE_BYTES)
  const read = await handle
    .read(sample, 0, sample.length, 0)
    .catch(() => undefined)
    .finally(() => handle.close())
  if (!read) return false
  return binary(sample.subarray(0, read.bytesRead))
}

export function resolveInside(dir: string, file: string): string | undefined {
  if (path.isAbsolute(file)) return undefined
  const full = path.resolve(dir, file)
  const base = path.resolve(dir)
  if (full !== base && !full.startsWith(base + path.sep)) return undefined
  return full
}

export function imageMime(file: string): string | undefined {
  return MIMES[path.extname(file).toLowerCase()]
}

export function readImageFile(file: string): Promise<Buffer | undefined> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let bytes = 0
    const stream = createReadStream(file, { end: MAX_IMAGE_BYTES, highWaterMark: 64 * 1024 })
    stream.on("data", (chunk) => {
      const data = typeof chunk === "string" ? Buffer.from(chunk) : chunk
      chunks.push(data)
      bytes += data.byteLength
    })
    stream.on("error", () => resolve(undefined))
    stream.on("end", () => resolve(Buffer.concat(chunks, bytes)))
  })
}

async function load(mime: string, source: ImageSource): Promise<DiffImageSide> {
  if (source.bytes > MAX_IMAGE_BYTES) return { mime, bytes: source.bytes, error: "too-large" }
  const data = await source.read().catch(() => undefined)
  if (!data?.byteLength) return { mime, bytes: source.bytes, error: "unreadable" }
  if (data.byteLength > MAX_IMAGE_BYTES) return { mime, bytes: data.byteLength, error: "too-large" }
  return { mime, bytes: data.byteLength, data: data.toString("base64") }
}

export async function loadImage(
  file: string,
  before?: ImageSource,
  after?: ImageSource,
): Promise<DiffImage | undefined> {
  const mime = imageMime(file)
  if (!mime) return undefined
  const [left, right] = await Promise.all([
    before ? load(mime, before) : undefined,
    after ? load(mime, after) : undefined,
  ])
  return { before: left, after: right }
}
