/**
 * Architecture test: FullScreenDiffView CSS imports.
 *
 * `FullScreenDiffView` and its children (`FileTree`, etc.) rely on classes
 * defined in both shared diff stylesheets. The component is shared by multiple
 * webview bundles. Historically, each bundle was responsible for
 * importing its own CSS, which led to regressions when someone forgot to
 * wire the review stylesheet into a new entry point (see PR #7455 fallout).
 *
 * Current invariant: `FullScreenDiffView.tsx` imports both stylesheets at the
 * top of the file, so any bundle pulling in the component transitively gets
 * the styles via esbuild's CSS bundling.
 *
 * If this test fails, do NOT move the CSS imports elsewhere — fix the
 * component file to import the missing stylesheet, or add a new stylesheet
 * to the REQUIRED list if you intentionally split the styles.
 */

import { describe, it, expect } from "bun:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "../..")
const FULL_SCREEN_DIFF_VIEW = path.join(ROOT, "webview-ui/diff-viewer/FullScreenDiffView.tsx")
const REQUIRED = ["../src/styles/diff-viewer.css", "../src/styles/diff-review.css"] as const

describe("FullScreenDiffView — CSS imports", () => {
  it("imports every stylesheet required to render correctly", () => {
    const src = fs.readFileSync(FULL_SCREEN_DIFF_VIEW, "utf-8")
    const missing = REQUIRED.filter((css) => !src.includes(`import "${css}"`))

    expect(
      missing,
      `FullScreenDiffView is missing required CSS imports:\n` +
        missing.map((m) => `  - import "${m}"`).join("\n") +
        `\n\nAdd them at the top of FullScreenDiffView.tsx. The component is\n` +
        `shared by multiple webview bundles, which rely on these imports for complete styling.\n`,
    ).toEqual([])
  })
})
