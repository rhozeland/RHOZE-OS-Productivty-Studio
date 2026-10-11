import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}", "**/*.js", "**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      "@typescript-eslint/no-unused-vars": "off",

      // Existing code contains many typed API-boundary casts.
      // Keep these visible without blocking the build while they are migrated.
      "@typescript-eslint/no-explicit-any": "warn",

      // Migrate this file separately instead of blocking all CI.
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-nocheck": "allow-with-description",
        },
      ],

      // Existing Tailwind/Deno code has a few intentional compatibility cases.
      "@typescript-eslint/no-require-imports": "warn",

      // Potentially consequential logic and async-control-flow issues remain errors.
      "no-constant-binary-expression": "error",
      "no-unexpected-multiline": "error",
      "no-async-promise-executor": "error",

      // Lower-priority cleanup issues are warnings rather than lint blockers.
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "prefer-const": "warn",

      // Permit empty catches used to intentionally ignore malformed optional data.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);