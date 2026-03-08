/**
 * k6 performance test: poche richieste, verifica soglia latenza.
 * Richiede k6 installato: https://k6.io/docs/get-started/installation/
 * BASE_URL default: API BE (health). Avviare il BE prima: npm run dev:be
 *
 * Esecuzione: npm run test:performance (dalla root) oppure k6 run performance/basic.js
 */
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5060";

export const options = {
  vus: 2,
  duration: "5s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/v1/health`);
  check(res, { "status is 200": (r) => r.status === 200 });
}
