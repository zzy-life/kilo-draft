import { describe, expect, test } from "bun:test"
import { DIRECT_FIM_ENV, resolveFimTarget } from "../src/fim"

describe("FIM target resolution", () => {
  test("uses the connected DeepSeek provider API key", () => {
    expect(DIRECT_FIM_ENV.deepseek).toEqual(["DEEPSEEK_API_KEY"])
  })

  test("keeps gateway autocomplete models on Kilo Gateway", () => {
    expect(resolveFimTarget("kilo", "mistralai/codestral-2508")).toEqual({
      provider: "kilo",
      model: "mistralai/codestral-2508",
      url: "https://api.kilo.ai/api/fim/completions",
    })
    expect(resolveFimTarget("kilo", "inception/mercury-edit-2")).toEqual({
      provider: "kilo",
      model: "inception/mercury-edit-2",
      url: "https://api.kilo.ai/api/fim/completions",
    })
  })

  test("routes explicit provider autocomplete models directly", () => {
    expect(resolveFimTarget("mistral", "codestral-2508")).toEqual({
      provider: "mistral",
      model: "codestral-2508",
    })
    expect(resolveFimTarget("inception", "mercury-edit-2")).toEqual({
      provider: "inception",
      model: "mercury-edit-2",
      url: "https://api.inceptionlabs.ai/v1/fim/completions",
    })
    expect(resolveFimTarget("deepseek", "deepseek-v4-flash")).toEqual({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      url: "https://api.deepseek.com/beta/completions",
    })
    expect(resolveFimTarget("deepseek", "deepseek-v4-pro")).toEqual({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      url: "https://api.deepseek.com/beta/completions",
    })
  })

  test("preserves gateway model pass-through behavior", () => {
    expect(resolveFimTarget()).toEqual({
      provider: "kilo",
      model: "mistralai/codestral-2501",
      url: "https://api.kilo.ai/api/fim/completions",
    })
    expect(resolveFimTarget(undefined, "mistralai/codestral-2508")).toEqual({
      provider: "kilo",
      model: "mistralai/codestral-2508",
      url: "https://api.kilo.ai/api/fim/completions",
    })
    expect(resolveFimTarget(undefined, "inception/mercury-edit")).toEqual({
      provider: "kilo",
      model: "inception/mercury-edit",
      url: "https://api.kilo.ai/api/fim/completions",
    })
    expect(resolveFimTarget("kilo", "custom/fim-model")).toEqual({
      provider: "kilo",
      model: "custom/fim-model",
      url: "https://api.kilo.ai/api/fim/completions",
    })
  })
})
