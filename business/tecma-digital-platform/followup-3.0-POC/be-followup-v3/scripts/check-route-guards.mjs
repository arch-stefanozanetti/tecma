#!/usr/bin/env node
/**
 * CI check: route in clients/requests/apartments/webhook-configs/assets/client-documents/workspaces
 * devono dichiarare guard di accesso. Vedi docs/ROUTE_ACCESS_ALLOWLIST.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, "../src/routes/v1");

const DEFAULT_GUARD =
  /requireCanAccess(Workspace|Project)|requireAccessToWebhookConfigById\(\)|\bwithWorkspaceAccess\b|\bwithProjectAccess\b/;

/** Workspaces: admin/permessi espliciti, requireCanAccessWorkspace, o lista con filtro in handler. */
const WORKSPACE_GUARD =
  /requireCanAccessWorkspace|requireCanAccessProject|requireAdmin|requireTecmaAdmin|requirePermission|requireAnyPermission|requirePermissionOrTecmaAdmin|workspace-list-self-filtered/;

/** file → nome router exportato nel sorgente */
const ROUTE_ROUTERS = [
  { file: "clients.routes.ts", router: "clientsRoutes", guardPattern: DEFAULT_GUARD },
  { file: "requests.routes.ts", router: "requestsRoutes", guardPattern: DEFAULT_GUARD },
  { file: "apartments.routes.ts", router: "apartmentsRoutes", guardPattern: DEFAULT_GUARD },
  { file: "webhook-configs.routes.ts", router: "webhookConfigsRoutes", guardPattern: DEFAULT_GUARD },
  { file: "assets.routes.ts", router: "assetsRoutes", guardPattern: DEFAULT_GUARD },
  { file: "client-documents.routes.ts", router: "clientDocumentsRoutes", guardPattern: DEFAULT_GUARD },
  { file: "workspaces.routes.ts", router: "workspacesRoutes", guardPattern: WORKSPACE_GUARD },
];

function checkFile(filePath, routerName, guardPattern) {
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
      if (!guardPattern.test(block)) {
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
for (const { file, router, guardPattern } of ROUTE_ROUTERS) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[route-guards] File not found: ${filePath}`);
    process.exit(2);
  }
  const errors = checkFile(filePath, router, guardPattern);
  if (errors.length) {
    failed = true;
    console.error(`[route-guards] ${file}: ${errors.length} route(s) missing access guard:`);
    for (const e of errors) {
      console.error(`  L${e.line}: ${e.method} ${e.path} — ${e.preview}`);
    }
  }
}

if (failed) {
  console.error("\n[route-guards] Add access guards per docs/ROUTE_ACCESS_ALLOWLIST.md");
  process.exit(1);
}
console.log("[route-guards] OK: all protected routes have access guards");
