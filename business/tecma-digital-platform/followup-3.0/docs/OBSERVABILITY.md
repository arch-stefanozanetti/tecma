# Observability (Pino + OpenTelemetry)

Followup 3.0 backend (`be-followup-v3`) usa:

- **Structured logging** con `pino` (JSON).
- **Request correlation** con header `x-request-id` e `x-correlation-id`.
- **OpenTelemetry** (auto-instrumentation Node HTTP + metriche/traces OTLP).

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
- `err` (quando presente)

## OpenTelemetry env

- `OTEL_EXPORTER_OTLP_ENDPOINT` (fallback globale)
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (opzionale, override trace)
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` (opzionale, override metriche)
- `OTEL_METRIC_EXPORT_INTERVAL_MS` (default `10000`)
- `OTEL_DEBUG=true` abilita diagnostica OTel lato processo.

