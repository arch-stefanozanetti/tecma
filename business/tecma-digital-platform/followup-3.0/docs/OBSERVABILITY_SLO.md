# Observability SLO (Followup 3.0)

## Scope

Core API scope (business critical):

- `/v1/auth/*`
- `/v1/clients*`
- `/v1/apartments*`
- `/v1/requests*`
- `/v1/calendar*`

## SLI Definitions

1. Availability SLI
- Formula: `1 - (5xx / total_requests)` on core API scope
- Source metrics: `followup_http_server_requests_total`, `followup_http_server_errors_total`

2. Latency SLI (p95)
- Formula: p95 of `followup_http_server_request_duration_ms`
- Source metric: `followup_http_server_request_duration_ms_bucket`

3. Freshness SLI (telemetry pipeline)
- Formula: scrape/export timestamp freshness of backend telemetry < 2m
- Source: collector/prometheus target health

## SLO Targets

1. Availability (monthly, 30d rolling)
- Target: `>= 99.5%`
- Error budget: `0.5%`

2. Latency p95 (5m windows)
- Read endpoints (`GET`): `< 400ms`
- Write endpoints (`POST/PATCH/DELETE`): `< 700ms`

3. Telemetry freshness
- Target: no gap > 2m for active environments

## Alerting Policy (burn-rate)

- Fast burn (critical): budget burn > 14x (5m)
- Slow burn (warning): budget burn > 2x (1h)
- Latency alerts:
  - critical if p95 > threshold for 15m
  - warning if p95 > threshold for 30m

## Dashboards (minimum)

- Core API availability
- Core API p95 latency by route/method
- Error rate by route/status class
- Throughput by route/method
- Top failing endpoints (5xx)

