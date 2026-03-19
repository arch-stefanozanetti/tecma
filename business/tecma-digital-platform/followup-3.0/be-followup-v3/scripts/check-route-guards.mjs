#!/usr/bin/env node
/**
 * CI check: routes in clients/requests/apartments must use requireCanAccessWorkspace
 * or requireCanAccessProject. See docs/ROUTE_ACCESS_ALLOWLIST.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, "../src/routes/v1");

const ROUTE_FILES = [
  "clients.routes.ts",
  "requests.routes.ts",
  "apartments.routes.ts",
];

const ROUTER_NAMES = ["clientsRoutes", "requestsRoutes", "apartmentsRoutes"];
const METHODS = ["get", "post", "patch", "put", "delete"];
const GUARD_PATTERN = /requireCanAccess(Workspace|Project)/;

function checkFile(filePath, routerName) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const errors = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const methodMatch = line.match(new RegExp(`${routerName}\\.(get|post|patch|put|delete)\\s*\\(`));
    if (methodMatch) {
      const method = methodMatch[1];
      let block = line;
      let j = i;
      while (j < lines.length && !block.includes("handleAsync") && !block.includes("requireAdmin")) {
        j++;
        if (j < lines.length) block += "\n" + lines[j];
      }
      if (!block.includes("handleAsync") && !block.includes("requireAdmin")) {
        i++;
        continue;
      }
      if (!GUARD_PATTERN.test(block)) {
        errors.push({ line: i + 1, method, path: line.match(/"([^"]+)"/)?.[1] ?? "?", preview: line.trim().slice(0, 80) });
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return errors;
}

let failed = false;
for (const file of ROUTE_FILES) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[route-guards] File not found: ${filePath}`);
    process.exit(2);
  }
  const routerName = file.replace(".routes.ts", "Routes");
  const errors = checkFile(filePath, routerName);
  if (errors.length) {
    failed = true;
    console.error(`[route-guards] ${file}: ${errors.length} route(s) missing requireCanAccessWorkspace/Project:`);
    for (const e of errors) {
      console.error(`  L${e.line}: ${e.method} ${e.path} — ${e.preview}`);
    }
  }
}

if (failed) {
  console.error("\n[route-guards] Add requireCanAccessWorkspace or requireCanAccessProject to every route. See docs/ROUTE_ACCESS_ALLOWLIST.md");
  process.exit(1);
}
console.log("[route-guards] OK: all protected routes have access guards");
