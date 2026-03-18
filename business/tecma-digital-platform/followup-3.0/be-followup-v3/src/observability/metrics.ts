import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("be-followup-v3");

const httpRequestDurationMs = meter.createHistogram("followup_http_server_request_duration_ms", {
  description: "HTTP server request duration for Followup backend",
  unit: "ms",
});

const httpRequestsTotal = meter.createCounter("followup_http_server_requests_total", {
  description: "HTTP server requests total for Followup backend",
});

const httpRequestErrorsTotal = meter.createCounter("followup_http_server_errors_total", {
  description: "HTTP server 5xx errors total for Followup backend",
});

const statusClass = (statusCode: number): string => {
  if (statusCode >= 500) return "5xx";
  if (statusCode >= 400) return "4xx";
  if (statusCode >= 300) return "3xx";
  if (statusCode >= 200) return "2xx";
  return "1xx";
};

const normalisePath = (rawPath: string): string =>
  rawPath
    .replace(/[0-9a-f]{24}\b/gi, ":id")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, ":id")
    .replace(/\/\d+\b/g, "/:id");

export interface ObserveHttpRequestInput {
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
}

export const observeHttpRequest = ({
  method,
  endpoint,
  statusCode,
  latencyMs,
}: ObserveHttpRequestInput): void => {
  const attrs = {
    "http.method": method,
    "http.route": normalisePath(endpoint),
    "http.status_code": statusCode,
    "http.status_class": statusClass(statusCode),
  };

  httpRequestDurationMs.record(latencyMs, attrs);
  httpRequestsTotal.add(1, attrs);
  if (statusCode >= 500) {
    httpRequestErrorsTotal.add(1, attrs);
  }
};

