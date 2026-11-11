// Renders the app icon to every size phones and browsers need.
// Run with: node scripts/make-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const svg = await readFile(path.join(here, "icons/icon.svg"));

const out = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/maskable-512.png", 512],
  ["src/app/apple-icon.png", 180],
  ["src/app/icon.png", 64],
];
for (const [file, size] of out) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(path.join(root, file));
  console.log("wrote", file);
}
