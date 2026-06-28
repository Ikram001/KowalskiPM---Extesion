import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

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
