import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// See vite.config.background.js for why this is a separate build rather
// than a second entry in the same config.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: false, // background build already ran and emptied dist/ once
    rollupOptions: {
      input: resolve(__dirname, "src/popup/index.html"),
    },
  },
});
