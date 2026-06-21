import { defineConfig } from "vite";
import { resolve } from "path";

// The background service worker gets its OWN Rollup build, entirely separate
// from the popup's. A combined multi-entry build let Rollup extract a tiny
// shared chunk (src/shared/format.js) used by both — which is harmless on a
// normal website, but a Chrome extension's popup page and its service worker
// are different execution "worlds", so the browser's modulepreload hint for
// that shared chunk goes unused and Chrome logs a (harmless but noisy)
// warning. Building each as an independent entry means every shared module
// just gets inlined into whichever bundle needs it — no shared chunk exists.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true, // runs first — popup build runs after with emptyOutDir: false
    rollupOptions: {
      input: resolve(__dirname, "src/background/background.js"),
      output: {
        entryFileNames: "background.js", // fixed name, referenced directly by manifest.json
        format: "es",
      },
    },
  },
});
