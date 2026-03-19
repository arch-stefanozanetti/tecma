#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const assetsDir = path.resolve(process.cwd(), "dist/assets");
const maxGzipBytes = 500 * 1024;

if (!fs.existsSync(assetsDir)) {
  throw new Error("[bundle-budget] dist/assets not found. Run build before this check.");
}

const jsFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
if (jsFiles.length === 0) {
  throw new Error("[bundle-budget] no JS assets found in dist/assets.");
}

let largest = { file: "", gzipBytes: 0 };
for (const file of jsFiles) {
  const fullPath = path.join(assetsDir, file);
  const buf = fs.readFileSync(fullPath);
  const gzipBytes = zlib.gzipSync(buf).length;
  if (gzipBytes > largest.gzipBytes) {
    largest = { file, gzipBytes };
  }
}

if (largest.gzipBytes > maxGzipBytes) {
  throw new Error(
    `[bundle-budget] ${largest.file} is ${(largest.gzipBytes / 1024).toFixed(1)} KB gzip, above limit ${(maxGzipBytes / 1024).toFixed(0)} KB.`
  );
}

console.log(
  `[bundle-budget] largest JS asset ${largest.file}: ${(largest.gzipBytes / 1024).toFixed(1)} KB gzip (limit ${(maxGzipBytes / 1024).toFixed(0)} KB).`
);
