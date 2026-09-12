import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const assets = resolve(root, "apps/mobile/assets");
const logo = await readFile(resolve(root, "apps/web/public/logo.svg"));

const foreground = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
  <path d="M16 46 29 17h7l13 29h-9l-3-8H26l-3 8Zm13-15h6l-3-9Z" fill="#263624"/>
  <path d="m18 48 30-13" stroke="#c39a43" stroke-width="3" stroke-linecap="round"/>
</svg>`);
const monochrome = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
  <path d="M16 46 29 17h7l13 29h-9l-3-8H26l-3 8Zm13-15h6l-3-9Z" fill="#000"/>
  <path d="m18 48 30-13" stroke="#000" stroke-width="3" stroke-linecap="round"/>
</svg>`);

await Promise.all([
  sharp(logo).resize(1024, 1024).png().toFile(resolve(assets, "icon.png")),
  sharp(logo).resize(512, 512).png().toFile(resolve(assets, "splash-icon.png")),
  sharp(logo).resize(64, 64).png().toFile(resolve(assets, "favicon.png")),
  sharp(foreground).png().toFile(resolve(assets, "android-icon-foreground.png")),
  sharp(monochrome).png().toFile(resolve(assets, "android-icon-monochrome.png")),
]);
