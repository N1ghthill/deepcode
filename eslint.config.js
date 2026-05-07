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
        TextDecoder: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"]
  },
  prettier
];
