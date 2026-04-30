#!/usr/bin/env node
/**
 * Runs Lighthouse (PWA + Performance) and enforces minimum scores.
 * Usage: node scripts/lighthouse-pwa.mjs [url]
 * Default URL: http://localhost:4173 (run `pnpm run preview` first).
 * Requires: npx lighthouse (installed on demand).
 *
 * Exits 0 if categories.pwa.score >= 0.9 and categories.performance.score >= 0.75, else 1.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || process.env.LIGHTHOUSE_URL || "http://localhost:4173";
const outFile = path.join(__dirname, "..", "lighthouse-report.json");
const PWA_MIN = 0.9;
const PERF_MIN = 0.75;

console.log(`[lighthouse-pwa] Running Lighthouse against ${url} ...`);

try {
  execFileSync(
    "npx",
    [
      "lighthouse",
      url,
      "--only-categories=pwa,performance",
      "--output=json",
      `--output-path=${outFile}`,
      "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
    ],
    {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    }
  );
} catch (err) {
  console.error("[lighthouse-pwa] Lighthouse run failed:", err.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(outFile, "utf8"));
} catch (err) {
  console.error("[lighthouse-pwa] Failed to read report:", err.message);
  process.exit(1);
}

const pwaScore = report?.categories?.pwa?.score ?? 0;
const perfScore = report?.categories?.performance?.score ?? 0;

console.log(`[lighthouse-pwa] PWA: ${(pwaScore * 100).toFixed(0)}, Performance: ${(perfScore * 100).toFixed(0)} (min PWA ${PWA_MIN * 100}, min Perf ${PERF_MIN * 100})`);

if (pwaScore < PWA_MIN || perfScore < PERF_MIN) {
  console.error(
    `[lighthouse-pwa] FAIL: PWA ${pwaScore < PWA_MIN ? `< ${PWA_MIN}` : "ok"}, Performance ${perfScore < PERF_MIN ? `< ${PERF_MIN}` : "ok"}`
  );
  process.exit(1);
}

console.log("[lighthouse-pwa] PASS.");
try {
  fs.unlinkSync(outFile);
} catch {
  // ignore
}
