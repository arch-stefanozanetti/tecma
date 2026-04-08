# Alert e metriche minime — Followup 3.0 (Render / BE)

Complemento a [OBSERVABILITY.md](OBSERVABILITY.md) e [OBSERVABILITY_SLO.md](OBSERVABILITY_SLO.md).  
Obiettivo: ridurre MTTR dopo deploy o incidenti di rete/DB.

---

## Checklist minima (operativa)

1. **Log error rate (BE)**  
   Su Render: filtrare log applicativi per `level` error/fatal negli ultimi 15 minuti dopo un deploy.  
   Pattern già visti in produzione: timeout Mongo, `[accessLog] write failed` (mitigato per `/v1/health`).

2. **HTTP 5xx**  
   Se disponibile nella dashboard Render o tramite proxy upstream: alert su picco di 5xx rispetto alla baseline.

3. **Health endpoint**  
   Monitoraggio esterno leggero (es. ogni 1–5 min) su `GET /v1/health`: atteso **200** e corpo `{"ok":true,...}`.  
   Il workflow [followup-3.0-production-verify.yml](../../../../.github/workflows/followup-3.0-production-verify.yml) copre il momento post-merge; l’alert continuo resta fuori da GitHub.

4. **Database**  
   Atlas / Mongo: alert su connection count, CPU, slow queries o replica set health (configurazione sul provider).

---

## Cosa non mettere in alert

- Rumore su 401 attesi su `/v1/auth/me` senza token (comportamento corretto).

---

## Estensioni future

- OpenTelemetry export già descritto in OBSERVABILITY.md: collegare a backend di tracing e definire SLO su latenza p95 per route critiche.
