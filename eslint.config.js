import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
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

      // Permit empty catches used to intentionally ignore malformed optional data.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
