module.exports = {
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
};
