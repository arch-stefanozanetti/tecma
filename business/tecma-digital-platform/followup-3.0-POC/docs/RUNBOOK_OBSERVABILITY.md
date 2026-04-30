# RUNBOOK_OBSERVABILITY

## Scope

Runbook operativo per incident response su disponibilita, latenza e telemetria del backend `be-followup-v3`.

## Prerequisiti

- Dashboard disponibili (availability, p95, error-rate, top endpoints)
- Alerting attivo con regole in `infra/prometheus/alerts-followup-observability.yml`
- Accesso ai log JSON centralizzati (campi `requestId`, `workspaceId`, `endpoint`, `error.code`)
- Accesso ai trace OTel per correlazione end-to-end

## Triage in 5 minuti

1. Confermare l'alert
- Verificare se e' singolo endpoint o pattern globale.
- Verificare ambiente (`env`) e finestra temporale.

2. Classificare impatto
- P1: availability fast burn o p95 write/read critical su endpoint core
- P2: slow burn o degradazione parziale

3. Correlazione rapida
- Usare `requestId` dai log errore per aprire trace correlato.
- Estrarre top 3 endpoint per 5xx/latency.

## Playbook per alert

### A) Availability Fast Burn (critical)

1. Filtrare log ultimi 5m su `statusCode >= 500`.
2. Raggruppare per `endpoint` e `error.code`.
3. Verificare dipendenze esterne (DB, SSO gateway, provider email/webhook).
4. Se causa nota e fix non immediato: rollback release corrente.
5. Validare recovery con 3 smoke checks:
- `GET /v1/health`
- login + query core
- create/update request base

### B) Latency p95 Critical

1. Identificare endpoint con p95 peggiore.
2. Aprire traces con durata > p95 target.
3. Distinguere CPU-bound vs I/O-bound:
- I/O-bound: verificare query Mongo lente e dipendenze esterne.
- CPU-bound: verificare regressioni recenti (feature flag, payload voluminosi).
4. Mitigazione:
- riduzione carico endpoint non-core
- rollback selettivo ultima release

### C) Telemetry Pipeline Stale

1. Verificare status collector/scraper.
2. Verificare endpoint OTLP e credenziali.
3. Verificare saturazione risorse collector.
4. Ripristinare pipeline e validare con nuova richiesta API + comparsa log/metric/trace.

## Comunicazione incidente

- Entro 10 minuti: stato iniziale + impatto + owner.
- Ogni 15 minuti: update sintetico con ETA.
- Chiusura: RCA breve + azione preventiva.

## Post-incident checklist

1. RCA documentata con trigger, blast radius, fix, prevention.
2. Nuovo test o alert aggiunto se gap emerso.
3. Aggiornamento SLO/error budget mensile.

