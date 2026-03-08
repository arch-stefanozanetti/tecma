/**
 * k6 load test: 10 VU per 30s.
 * Richiede k6 installato. BASE_URL default: API BE. Avviare il BE prima.
 *
 * Esecuzione: npm run test:load (dalla root) oppure k6 run load/load.js
 */
import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5060";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/v1/health`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.5);
}
