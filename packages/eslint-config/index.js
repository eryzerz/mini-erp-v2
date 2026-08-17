import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";

const base = defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/generated/**",
    "**/coverage/**",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      boundaries,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
    },
    settings: {
      "boundaries/elements": [
        { type: "api", pattern: "apps/api-*/*" },
        { type: "zone", pattern: "apps/zone-*/*" },
        { type: "libs", pattern: "libs/*" },
        { type: "packages", pattern: "packages/*" },
      ],
      "boundaries/ignore": ["**/*.spec.ts", "**/*.test.ts", "**/*.config.*", "**/generated/**"],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Fleet boundary matrix: services may import libs + packages; zones may
      // import packages only; libs and packages stay leaf-level. Services and
      // zones never import one another.
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "api", allow: ["libs", "packages"] },
            { from: "zone", allow: ["packages"] },
            { from: "libs", allow: ["packages"] },
            { from: "packages", allow: ["packages"] },
          ],
        },
      ],
    },
  },
);

export default base;
