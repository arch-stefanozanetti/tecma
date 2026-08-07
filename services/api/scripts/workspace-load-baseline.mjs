/**
 * Baseline leggero per PR40 (performance smoke): misura latenza ripetuta su `/v1/health`.
 * Richiede API in ascolto su WORKSPACE_LOAD_BASE_URL (default http://127.0.0.1:3000).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const baseUrl = process.env.WORKSPACE_LOAD_BASE_URL ?? 'http://127.0.0.1:3000';
const iterations = Math.max(1, Number.parseInt(process.env.WORKSPACE_LOAD_ITERATIONS ?? '25', 10));

function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.min(Math.max(0, idx), sortedMs.length - 1)];
}

async function main() {
  const latencies = [];
  let failures = 0;
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    try {
      const res = await fetch(new URL('/v1/health', baseUrl));
      const ms = performance.now() - t0;
      latencies.push(ms);
      if (!res.ok) failures += 1;
    } catch {
      failures += 1;
      latencies.push(NaN);
    }
  }

  const okLat = latencies.filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    iterations,
    failures,
    latencyMs: {
      min: okLat[0] ?? null,
      p50: percentile(okLat, 50),
      p95: percentile(okLat, 95),
      max: okLat[okLat.length - 1] ?? null,
    },
    note: 'Smoke locale: avviare `pnpm -C services/api dev` e impostare WORKSPACE_LOAD_BASE_URL se la porta differisce.',
  };

  const outDir = join(__dirname, '..', 'security-reports');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'workspace-load-baseline.json');
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
  if (failures > 0) {
    console.warn(`Warning: ${failures} failed requests (server down or wrong URL?).`);
    process.exitCode = 2;
  }
}

await main();
