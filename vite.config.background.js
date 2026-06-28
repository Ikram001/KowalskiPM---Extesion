import { defineConfig } from "vite";
import { resolve } from "path";

// The background service worker gets its own isolated Rollup build so that
// shared modules are inlined rather than extracted into a chunk — avoids a
// noisy Chrome "preloaded but not used" warning from modulepreload hints that
// don't apply across extension execution contexts.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true, // runs first — popup build runs after with emptyOutDir: false
    rollupOptions: {
      input: resolve(__dirname, "src/background/background.js"),
      output: {
        entryFileNames: "background.js",
        format: "es",
      },
    },
  },
});
