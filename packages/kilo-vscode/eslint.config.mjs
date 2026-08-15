import typescriptEslint from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
  },
  {
    plugins: {
      "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
      parser: typescriptEslint.parser,
      ecmaVersion: 2022,
      sourceType: "module",
    },

    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],

      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      "max-lines": ["error", 3000],
      complexity: ["error", 20],
    },
  },

  // ── Complexity exceptions ─────────────────────────────────────────
  // Existing complexity violations are capped at their current max.
  // New code must stay ≤ 20. Do not raise complexity caps; refactor instead.
  {
    files: ["src/services/autocomplete/classic-auto-complete/AutocompleteInlineCompletionProvider.ts"],
    rules: { complexity: ["error", 30] },
  },
  {
    files: ["src/agent-manager/WorktreeManager.ts"],
    rules: { complexity: ["error", 28] },
  },
  {
    files: [
      "src/kilo-provider-utils.ts",
      "src/services/autocomplete/continuedev/core/autocomplete/postprocessing/index.ts",
    ],
    rules: { complexity: ["error", 27] },
  },
  {
    files: ["src/agent-manager/WorktreeStateManager.ts"],
    rules: { complexity: ["error", 24] },
  },
  {
    files: ["src/services/autocomplete/continuedev/core/autocomplete/filtering/BracketMatchingService.ts"],
    rules: { complexity: ["error", 22] },
  },
  {
    files: ["webview-ui/src/context/server.tsx"],
    rules: { complexity: ["error", 21] },
  },

  eslintConfigPrettier,
]
