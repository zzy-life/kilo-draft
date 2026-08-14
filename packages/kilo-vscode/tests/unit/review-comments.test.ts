import { describe, it, expect } from "bun:test"
import {
  formatReviewCommentsMarkdown,
  parseReview,
  partReview,
  reviewMetadata,
  type ReviewCommentData,
} from "../../src/shared/review-comments"

function comment(overrides: Partial<ReviewCommentData> & Pick<ReviewCommentData, "file" | "line">): ReviewCommentData {
  return {
    id: `c-${overrides.file}-${overrides.line}`,
    side: "additions",
    comment: "test comment",
    selectedText: "",
    ...overrides,
  }
}

// ── formatReviewCommentsMarkdown ────────────────────────────────────────────

describe("formatReviewCommentsMarkdown", () => {
  it("returns header only for empty array", () => {
    const result = formatReviewCommentsMarkdown([])
    expect(result).toBe("## Review Comments")
  })

  it("formats a single comment without selected text", () => {
    const result = formatReviewCommentsMarkdown([
      comment({ file: "src/a.ts", line: 5, comment: "Fix this", selectedText: "" }),
    ])
    expect(result).toContain("**src/a.ts** (line 5):")
    expect(result).toContain("Fix this")
    expect(result).not.toContain("```")
  })

  it("includes code block for comment with selected text", () => {
    const result = formatReviewCommentsMarkdown([
      comment({ file: "a.ts", line: 1, comment: "Wrong return", selectedText: "return null" }),
    ])
    expect(result).toContain("```\nreturn null\n```")
    expect(result).toContain("Wrong return")
  })

  it("formats multiple comments in order", () => {
    const result = formatReviewCommentsMarkdown([
      comment({ file: "a.ts", line: 1, comment: "First" }),
      comment({ file: "b.ts", line: 10, comment: "Second", selectedText: "code" }),
    ])
    const firstIdx = result.indexOf("**a.ts** (line 1):")
    const secondIdx = result.indexOf("**b.ts** (line 10):")
    expect(firstIdx).toBeLessThan(secondIdx)
  })
})

describe("review message metadata", () => {
  const comments = [comment({ file: "src/a.ts", line: 5, comment: "Fix this", selectedText: "const a = 1" })]
  const content = `${formatReviewCommentsMarkdown(comments)}\n\nPlease address this feedback.`
  const review = { version: 1 as const, comments }

  it("round-trips review comments and extracts the visible body", () => {
    expect(partReview(reviewMetadata(review), content)).toEqual({
      data: review,
      body: "Please address this feedback.",
    })
  })

  it("extracts an empty body from a review-only message", () => {
    expect(partReview(reviewMetadata(review), formatReviewCommentsMarkdown(comments))?.body).toBe("")
  })

  it("rejects malformed review comments", () => {
    expect(parseReview({ ...review, comments: [{ ...comments[0], line: 0 }] }, content)).toBeUndefined()
    expect(parseReview({ ...review, comments: [{ ...comments[0], side: "context" }] }, content)).toBeUndefined()
    expect(parseReview({ ...review, comments: [{ ...comments[0], file: "../secret" }] }, content)).toBeUndefined()
    expect(parseReview({ ...review, comments: [{ ...comments[0], file: "/tmp/secret" }] }, content)).toBeUndefined()
  })

  it("rejects metadata that does not match the hidden text", () => {
    expect(parseReview(review, `unrelated hidden text\n\n${content}`)).toBeUndefined()
  })

  it("rejects oversized aggregate metadata before formatting it", () => {
    const oversized = Array.from({ length: 6 }, (_, index) =>
      comment({ id: `comment-${index}`, selectedText: "x".repeat(200_000) }),
    )
    expect(parseReview({ version: 1, comments: oversized }, "irrelevant")).toBeUndefined()
  })
})
