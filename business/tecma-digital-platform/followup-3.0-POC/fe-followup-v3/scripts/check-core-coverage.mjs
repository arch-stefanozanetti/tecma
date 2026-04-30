#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const profile = process.argv[2] ?? "floor";

const profiles = {
  floor: {
    global: { lines: 55, statements: 55, functions: 25, branches: 50 },
    critical: { lines: 75, statements: 75, functions: 60, branches: 55 },
  },
  target: {
    global: { lines: 75, statements: 75, functions: 70, branches: 70 },
    critical: { lines: 90, statements: 90, functions: 85, branches: 85 },
  },
};

if (!profiles[profile]) {
  console.error(`[coverage] Unknown profile '${profile}'. Use: ${Object.keys(profiles).join(", ")}`);
  process.exit(2);
}

const summaryPath = path.resolve("coverage/coverage-summary.json");
if (!fs.existsSync(summaryPath)) {
  console.error(`[coverage] Missing ${summaryPath}. Run test:coverage:core first.`);
  process.exit(2);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const thresholds = profiles[profile];
const metricNames = ["lines", "statements", "functions", "branches"];

const criticalFiles = [
  "src/auth/projectScope.ts",
  "src/api/http.ts",
  "src/api/authApi.ts",
];

function checkBlock(blockName, data, blockThresholds, errors) {
  for (const metric of metricNames) {
    const total = Number(data?.[metric]?.total ?? 0);
    if (total === 0) continue;
    const actual = Number(data?.[metric]?.pct ?? 0);
    const min = blockThresholds[metric];
    if (actual < min) {
      errors.push(`${blockName} ${metric}: ${actual.toFixed(2)}% < ${min}%`);
    }
  }
}

const errors = [];
checkBlock("global", summary.total, thresholds.global, errors);

for (const file of criticalFiles) {
  const key = Object.keys(summary).find((k) => k.endsWith(file));
  const fileData = key ? summary[key] : undefined;
  if (!fileData) {
    errors.push(`critical missing in coverage summary: ${file}`);
    continue;
  }
  checkBlock(`critical ${file}`, fileData, thresholds.critical, errors);
}

if (errors.length > 0) {
  console.error(`[coverage] Profile '${profile}' FAILED`);
  for (const err of errors) console.error(` - ${err}`);
  process.exit(1);
}

console.log(`[coverage] Profile '${profile}' PASSED`);
