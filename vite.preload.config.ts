import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const external = [
  "electron",
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/utils/preload.ts",
      fileName: () => "preload.mjs",
      formats: ["es"],
    },
    minify: false,
    outDir: "dist",
    rollupOptions: {
      external,
    },
    sourcemap: false,
    target: "node24",
  },
});
