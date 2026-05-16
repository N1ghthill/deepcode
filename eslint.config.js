import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module"
      },
      globals: {
        AbortSignal: "readonly",
        AbortController: "readonly",
        Buffer: "readonly",
        console: "readonly",
        fetch: "readonly",
        HeadersInit: "readonly",
        NodeJS: "readonly",
        process: "readonly",
        RequestInit: "readonly",
        Response: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        TextDecoder: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off"
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // TypeScript already reports undefined identifiers; core `no-undef`
      // does not understand TS globals/types and produces false positives.
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "**/tui-old/**",
      "**/test-old/**"
    ]
  },
  prettier
];
