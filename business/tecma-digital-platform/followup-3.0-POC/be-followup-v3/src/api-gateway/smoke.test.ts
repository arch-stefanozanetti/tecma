/**
 * Smoke test contro AWS API Gateway (TECMA-BSS).
 * Esegue richieste HTTP reali quando API_GATEWAY_BASE_URL è impostato
 * (es. https://api.tecmasolutions.com/biz-tecma-dev1/v1).
 *
 * Uso: API_GATEWAY_BASE_URL=https://... npm run test:api:gateway
 * In CI/staging: imposta la variabile e lancia questo test per validare il gateway.
 */
import { describe, it, expect } from "vitest";

const BASE_URL = process.env.API_GATEWAY_BASE_URL?.replace(/\/$/, "") ?? "";

describe.skipIf(!BASE_URL)("API Gateway smoke (API_GATEWAY_BASE_URL)", () => {
  it("GET /health returns 200 and ok: true", async () => {
    const url = `${BASE_URL}/health`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; service?: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBeDefined();
  });

  it("GET /openapi.json returns 200 and OpenAPI spec", async () => {
    const url = `${BASE_URL}/openapi.json`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { openapi?: string; paths?: unknown };
    expect(body.openapi).toBeDefined();
    expect(body.paths).toBeDefined();
    expect(typeof body.paths).toBe("object");
  });
});
