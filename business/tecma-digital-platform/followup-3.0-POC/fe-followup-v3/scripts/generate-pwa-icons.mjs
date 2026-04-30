#!/usr/bin/env node
/**
 * Generates PWA icons (192x192 and 512x512 PNG) from public/tecma-t-icon.svg.
 * Run: pnpm run generate-pwa-icons
 * Requires: sharp (devDependency)
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const svgPath = path.join(publicDir, "tecma-t-icon.svg");
const svg = readFileSync(svgPath);

async function generate() {
  for (const size of [192, 512]) {
    const outPath = path.join(publicDir, `icon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(outPath);
    console.log(`Written ${outPath}`);
  }
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
