import { describe, expect, test } from "bun:test"
import {
  AUTOCOMPLETE_MODELS,
  DEFAULT_AUTOCOMPLETE_MODEL,
  DEFAULT_AUTOCOMPLETE_MODEL_ID,
  DEFAULT_AUTOCOMPLETE_PROVIDER_ID,
  getAutocompleteModel,
  validAutocompleteModel,
  validAutocompleteProvider,
} from "../src/autocomplete"

describe("DEFAULT_AUTOCOMPLETE_MODEL", () => {
  test("resolves to Mercury Next Edit through Kilo Gateway", () => {
    const match = AUTOCOMPLETE_MODELS.find(
      (m) => m.providerID === DEFAULT_AUTOCOMPLETE_PROVIDER_ID && m.modelID === DEFAULT_AUTOCOMPLETE_MODEL_ID,
    )
    expect(DEFAULT_AUTOCOMPLETE_PROVIDER_ID).toBe("kilo")
    expect(DEFAULT_AUTOCOMPLETE_MODEL_ID).toBe("inception/mercury-next-edit")
    expect(match).toBeDefined()
    expect(DEFAULT_AUTOCOMPLETE_MODEL).toBe(match!)
    expect(DEFAULT_AUTOCOMPLETE_MODEL.kind).toBe("edit")
  })
})

describe("DeepSeek FIM models", () => {
  test("resolve and validate the connected DeepSeek provider models", () => {
    const flash = getAutocompleteModel("deepseek", "deepseek-v4-flash")
    expect(flash.id).toBe("deepseek/deepseek-v4-flash")
    expect(flash.kind).not.toBe("edit")
    expect(flash.requestModel).toBe("deepseek-v4-flash")

    const pro = getAutocompleteModel("deepseek", "deepseek-v4-pro")
    expect(pro.id).toBe("deepseek/deepseek-v4-pro")
    expect(pro.kind).not.toBe("edit")
    expect(pro.requestModel).toBe("deepseek-v4-pro")

    expect(validAutocompleteProvider("deepseek")).toBe(true)
    expect(validAutocompleteModel("deepseek-v4-flash")).toBe(true)
    expect(validAutocompleteModel("deepseek-v4-pro")).toBe(true)
  })
})

describe("Qwen FIM model", () => {
  test("resolves and validates the connected Alibaba China provider model", () => {
    const qwen = getAutocompleteModel("alibaba-cn", "qwen-coder-turbo")
    expect(qwen.id).toBe("alibaba-cn/qwen-coder-turbo")
    expect(qwen.kind).not.toBe("edit")
    expect(qwen.requestModel).toBe("qwen-coder-turbo")

    expect(validAutocompleteProvider("alibaba-cn")).toBe(true)
    expect(validAutocompleteModel("qwen-coder-turbo")).toBe(true)
  })
})

describe("Next Edit FIM models", () => {
  test("reference a FIM model from the same provider", () => {
    for (const model of AUTOCOMPLETE_MODELS) {
      if (model.kind !== "edit") continue
      const sibling = AUTOCOMPLETE_MODELS.find((candidate) => candidate.id === model.fimModelID)
      expect(sibling).toBeDefined()
      expect(sibling?.kind).not.toBe("edit")
      expect(sibling?.providerID).toBe(model.providerID)
    }
  })
})
