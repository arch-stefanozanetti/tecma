/**
 * k6 stress test: ramping VU oltre il limite per trovare il punto di cedimento.
 * Richiede k6 installato. Avviare il BE prima.
 *
 * Esecuzione: npm run test:stress (dalla root) oppure k6 run load/stress.js
 */
import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.2"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/v1/health`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.2);
}
