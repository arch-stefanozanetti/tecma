import { readFileSync } from "node:fs";

const OPENAPI_SPEC_URL = new URL("../../openapi/openapi.v1.yaml", import.meta.url);

function loadOpenApiSpec(): Record<string, unknown> {
  const raw = readFileSync(OPENAPI_SPEC_URL, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (typeof parsed.openapi !== "string" || typeof parsed.paths !== "object" || parsed.paths == null) {
    throw new Error("Invalid OpenAPI spec: missing openapi or paths");
  }
  return parsed;
}

export const openApiV1 = loadOpenApiSpec();
