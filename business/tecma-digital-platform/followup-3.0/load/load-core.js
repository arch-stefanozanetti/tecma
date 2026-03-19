/**
 * k6 load test: endpoint core autenticati (clients/requests/apartments query).
 * Richiede k6. Variabili d'ambiente: BASE_URL, AUTH_BEARER (o nessuno per solo health).
 * Opzionali: WORKSPACE_ID, PROJECT_ID (default ws1, p1 per staging/demo).
 * SLO: p95 GET < 400ms, POST < 700ms, error rate < 1% (OBSERVABILITY_SLO.md).
 *
 * Esecuzione: k6 run load/load-core.js
 * Con token: AUTH_BEARER="Bearer <token>" WORKSPACE_ID=ws1 PROJECT_ID=p1 k6 run load/load-core.js
 */
import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const AUTH_BEARER = __ENV.AUTH_BEARER || "";
const WORKSPACE_ID = __ENV.WORKSPACE_ID || "ws1";
const PROJECT_ID = __ENV.PROJECT_ID || "p1";

export const options = {
  vus: 20,
  duration: "60s",
  thresholds: {
    "http_req_duration{name:health}": ["p(95)<400"],
    "http_req_duration{name:query}": ["p(95)<700"],
    http_req_failed: ["rate<0.01"],
  },
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  ...(AUTH_BEARER ? { Authorization: AUTH_BEARER.startsWith("Bearer ") ? AUTH_BEARER : `Bearer ${AUTH_BEARER}` } : {}),
});

const queryParams = { tags: { name: "query" } };

export default function () {
  const healthRes = http.get(`${BASE_URL}/v1/health`, { tags: { name: "health" } });
  check(healthRes, { "health 200": (r) => r.status === 200 });

  if (!AUTH_BEARER) {
    sleep(0.5);
    return;
  }

  const queryBody = JSON.stringify({
    workspaceId: WORKSPACE_ID,
    projectIds: [PROJECT_ID],
    page: 1,
    perPage: 25,
  });

  const clientsRes = http.post(`${BASE_URL}/v1/clients/query`, queryBody, { headers: authHeaders(), ...queryParams });
  check(clientsRes, { "clients/query 200": (r) => r.status === 200 });

  const requestsRes = http.post(`${BASE_URL}/v1/requests/query`, queryBody, { headers: authHeaders(), ...queryParams });
  check(requestsRes, { "requests/query 200": (r) => r.status === 200 });

  const apartmentsRes = http.post(`${BASE_URL}/v1/apartments/query`, queryBody, { headers: authHeaders(), ...queryParams });
  check(apartmentsRes, { "apartments/query 200": (r) => r.status === 200 });

  sleep(0.3);
}
