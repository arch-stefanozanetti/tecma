# Observability (Pino + OpenTelemetry)

Followup 3.0 backend (`be-followup-v3`) usa:

- **Structured logging** con `pino` (JSON).
- **Request correlation** con header `x-request-id` e `x-correlation-id`.
- **OpenTelemetry** (auto-instrumentation Node HTTP + metriche/traces OTLP).
- **Metriche applicative SLO-ready** su HTTP core.

## Runtime conventions

- Se `x-request-id` non è presente, il backend genera un UUID e lo restituisce in risposta.
- `x-correlation-id` viene propagato internamente; se assente, usa `x-request-id`.
- Gli error payload API includono `requestId` quando disponibile.

## Campi log principali

- `service`, `env`
- `requestId`, `correlationId`
- `method`, `endpoint`
- `userId`, `workspaceId`
- `statusCode`, `latencyMs`
- `error.code` (quando disponibile)
- `err` (quando presente)

## Metriche SLO

Il backend emette metriche applicative con label a cardinalita controllata:

- `followup_http_server_request_duration_ms` (histogram)
- `followup_http_server_requests_total` (counter)
- `followup_http_server_errors_total` (counter, solo 5xx)

Label principali:

- `http.method`
- `http.route` (normalizzata)
- `http.status_code`
- `http.status_class` (`2xx`, `4xx`, `5xx`, ...)

## Tracing

- Tracing HTTP inbound attivo via auto-instrumentation OTel.
- Gli errori applicativi impostano `span.status` e `error.code`.
- Le richieste includono attributi app-level (`app.endpoint`, `app.latency_ms`, `app.workspace_id`).

## OpenTelemetry env

- `OTEL_EXPORTER_OTLP_ENDPOINT` (fallback globale)
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (opzionale, override trace)
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` (opzionale, override metriche)
- `OTEL_METRIC_EXPORT_INTERVAL_MS` (default `10000`)
- `OTEL_DEBUG=true` abilita diagnostica OTel lato processo.

## SLO, Alerting, Runbook

- SLO ufficiali: `docs/OBSERVABILITY_SLO.md`
- Alert rules Prometheus: `infra/prometheus/alerts-followup-observability.yml`
- Runbook incident response: `docs/RUNBOOK_OBSERVABILITY.md`
