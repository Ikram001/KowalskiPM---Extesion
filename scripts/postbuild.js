// Runs after `vite build`. Vite emits the popup HTML at the same relative
// path as its source (dist/src/popup/index.html); this moves it to
// dist/popup.html to match manifest.json's action.default_popup. It also
// copies manifest.json and the icon set into dist/, since those aren't part
// of the Rollup graph.
import { mkdir, copyFile, rename, rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

async function main() {
  const builtHtml = resolve(dist, "src/popup/index.html");
  const finalHtml = resolve(dist, "popup.html");
  if (existsSync(builtHtml)) {
    await rename(builtHtml, finalHtml);
  } else if (!existsSync(finalHtml)) {
    throw new Error(`Expected built popup HTML at ${builtHtml}`);
  }
  // Clean up the now-empty src/ scaffold folder Vite left behind.
  const leftoverSrc = resolve(dist, "src");
  if (existsSync(leftoverSrc)) {
    await rm(leftoverSrc, { recursive: true, force: true });
  }

  if (!existsSync(resolve(dist, "background.js"))) {
    throw new Error("Expected background.js at dist root — check vite.config.js entryFileNames");
  }

  await copyFile(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));

  const iconsSrc = resolve(root, "public/icons");
  const iconsDest = resolve(dist, "icons");
  await mkdir(iconsDest, { recursive: true });
  for (const file of await readdir(iconsSrc)) {
    await copyFile(resolve(iconsSrc, file), resolve(iconsDest, file));
  }

  console.log("postbuild: dist/ is a ready-to-load unpacked extension.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
