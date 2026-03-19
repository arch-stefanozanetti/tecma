#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const specPath = path.resolve(process.cwd(), "openapi/openapi.v1.yaml");
const raw = fs.readFileSync(specPath, "utf8");
const spec = JSON.parse(raw);

if (typeof spec?.openapi !== "string") {
  throw new Error("OpenAPI check failed: 'openapi' missing.");
}
if (!spec?.paths || typeof spec.paths !== "object") {
  throw new Error("OpenAPI check failed: 'paths' missing.");
}

const methodSet = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
for (const [route, value] of Object.entries(spec.paths)) {
  if (!route.startsWith("/")) {
    throw new Error(`OpenAPI check failed: route '${route}' must start with '/'.`);
  }
  if (!value || typeof value !== "object") {
    throw new Error(`OpenAPI check failed: route '${route}' has invalid object.`);
  }
  const methods = Object.keys(value).filter((key) => methodSet.has(key));
  if (methods.length === 0) {
    throw new Error(`OpenAPI check failed: route '${route}' has no HTTP methods.`);
  }
}

console.log("[openapi] spec parsed and validated:", specPath);
