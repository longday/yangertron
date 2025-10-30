import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";

const VIRTUAL_ENTRY = "virtual:empty-renderer";

// https://vitejs.dev/config/
export default defineConfig({
  appType: "custom",
  build: {
    rollupOptions: {
      input: VIRTUAL_ENTRY,
    },
  },
  plugins: [
    {
      name: "virtual-empty-renderer",
      resolveId(id) {
        if (id === VIRTUAL_ENTRY) {
          return id;
        }
      },
      load(id) {
        if (id === VIRTUAL_ENTRY) {
          return "export {}";
        }
      },
    },
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: "src/main.ts",
        vite: {
          build: {
            outDir: "dist",
            emptyOutDir: false,
            rollupOptions: {
              output: {
                entryFileNames: "main.js",
              },
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, "src/utils/preload.ts"),
        vite: {
          build: {
            outDir: "dist",
            emptyOutDir: false,
            rollupOptions: {
              output: {
                entryFileNames: "preload.mjs",
              },
            },
          },
        },
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer:
        process.env.NODE_ENV === "test"
          ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
            undefined
          : {},
    }),
  ],
});
