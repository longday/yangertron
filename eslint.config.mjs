import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.config({
    root: true,
    env: {
      es2022: true,
      node: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      warnOnUnsupportedTypeScriptVersion: false,
    },
    plugins: ["@typescript-eslint", "electron"],
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:electron/recommended",
      "plugin:prettier/recommended",
    ],
    ignorePatterns: ["dist/", "release/", "node_modules/"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "no-multiple-empty-lines": [
        "error",
        {
          max: 1,
          maxEOF: 0,
          maxBOF: 0,
        },
      ],
    },
    overrides: [
      {
        files: ["src/preload.ts"],
        env: {
          browser: true,
          node: true,
        },
      },
      {
        files: ["vite.config.ts"],
        env: {
          node: true,
        },
      },
    ],
  }),
];
