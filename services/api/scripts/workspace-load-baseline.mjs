/**
 * Baseline di carico dell'API.
 *
 * Misura latenza e throughput su piu' rotte, con concorrenza configurabile, e
 * produce sia il JSON per la CI sia una tabella markdown leggibile in review.
 * E' il numero da mostrare quando qualcuno chiede "quanto regge".
 *
 * Variabili:
 *   WORKSPACE_LOAD_BASE_URL     default http://127.0.0.1:3000
 *   WORKSPACE_LOAD_ITERATIONS   richieste per rotta (default 25)
 *   WORKSPACE_LOAD_CONCURRENCY  richieste in volo (default 1)
 *   WORKSPACE_LOAD_TOKEN        bearer JWT, per misurare anche le rotte protette
 *   WORKSPACE_LOAD_PATHS        elenco separato da virgole, sovrascrive il default
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const baseUrl = process.env.WORKSPACE_LOAD_BASE_URL ?? 'http://127.0.0.1:3000';
const iterations = Math.max(1, Number.parseInt(process.env.WORKSPACE_LOAD_ITERATIONS ?? '25', 10));
const concurrency = Math.max(1, Number.parseInt(process.env.WORKSPACE_LOAD_CONCURRENCY ?? '1', 10));
const token = process.env.WORKSPACE_LOAD_TOKEN ?? null;

/**
 * Rotte pubbliche di default. Con WORKSPACE_LOAD_TOKEN valorizzato conviene
 * passare anche le rotte calde autenticate via WORKSPACE_LOAD_PATHS.
 */
const defaultPaths = ['/v1/health', '/v1/openapi.json'];
const paths = (process.env.WORKSPACE_LOAD_PATHS ?? defaultPaths.join(','))
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.min(Math.max(0, idx), sortedMs.length - 1)];
}

const round = (n) => (n == null ? null : Math.round(n * 100) / 100);

async function measurePath(path) {
  const headers = token != null ? { authorization: `Bearer ${token}` } : {};
  const latencies = [];
  let failures = 0;
  const statuses = {};

  const runOne = async () => {
    const t0 = performance.now();
    try {
      const res = await fetch(new URL(path, baseUrl), { headers });
      latencies.push(performance.now() - t0);
      statuses[res.status] = (statuses[res.status] ?? 0) + 1;
      if (!res.ok) failures += 1;
    } catch {
      failures += 1;
      statuses['network-error'] = (statuses['network-error'] ?? 0) + 1;
    }
  };

  const startedAt = performance.now();
  let issued = 0;
  const workers = Array.from({ length: Math.min(concurrency, iterations) }, async () => {
    while (issued < iterations) {
      issued += 1;
      await runOne();
    }
  });
  await Promise.all(workers);
  const wallMs = performance.now() - startedAt;

  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    path,
    iterations,
    concurrency,
    failures,
    statuses,
    throughputRps: round((latencies.length / wallMs) * 1000),
    latencyMs: {
      min: round(sorted[0] ?? null),
      p50: round(percentile(sorted, 50)),
      p95: round(percentile(sorted, 95)),
      p99: round(percentile(sorted, 99)),
      max: round(sorted[sorted.length - 1] ?? null),
    },
  };
}

function toMarkdown(results) {
  const rows = results.map(
    (r) =>
      `| \`${r.path}\` | ${r.latencyMs.p50} | ${r.latencyMs.p95} | ${r.latencyMs.p99} | ${r.latencyMs.max} | ${r.throughputRps} | ${r.failures} |`,
  );
  return [
    `# Baseline di carico API`,
    ``,
    `Base URL: ${baseUrl} — ${iterations} richieste per rotta, concorrenza ${concurrency}.`,
    ``,
    `| Rotta | p50 ms | p95 ms | p99 ms | max ms | req/s | errori |`,
    `| --- | ---: | ---: | ---: | ---: | ---: | ---: |`,
    ...rows,
    ``,
  ].join('\n');
}

async function main() {
  const results = [];
  for (const path of paths) {
    results.push(await measurePath(path));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    iterations,
    concurrency,
    authenticated: token != null,
    results,
    note: 'Avviare `pnpm -C services/api dev` e impostare WORKSPACE_LOAD_BASE_URL se la porta differisce.',
  };

  const outDir = join(__dirname, '..', 'security-reports');
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, 'workspace-load-baseline.json');
  const mdPath = join(outDir, 'workspace-load-baseline.md');
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, toMarkdown(results), 'utf8');
  console.log(toMarkdown(results));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);

  const failures = results.reduce((acc, r) => acc + r.failures, 0);
  if (failures > 0) {
    console.warn(`Warning: ${failures} failed requests (server down or wrong URL?).`);
    process.exitCode = 2;
  }
}

await main();
