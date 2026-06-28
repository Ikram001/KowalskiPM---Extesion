// Runs after `vite build`. Moves the popup HTML from its Vite-emitted path
// to dist/popup.html, copies manifest.json + icons into dist/.
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

  const leftoverSrc = resolve(dist, "src");
  if (existsSync(leftoverSrc)) {
    await rm(leftoverSrc, { recursive: true, force: true });
  }

  if (!existsSync(resolve(dist, "background.js"))) {
    throw new Error("Expected background.js at dist root — check vite.config.background.js");
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
