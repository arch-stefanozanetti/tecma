# Fase 4 — Report, dashboard, AI

## Obiettivi

- Definizioni report persistite ed esecuzione aggregata (query parametrizzate).
- Dashboard condivisibili: token read-only scoped (stesso pattern del preventivo).
- AI: opt-in, chiave/config per workspace; nessuna chiamata LLM senza setup esplicito.

## Integrazione esistente

- Platform API: `POST /v1/platform/reports/kpi-summary` (KPI minimi) con API key.

## Stato implementazione (repo)

| Elemento | Stato | Note |
|----------|--------|------|
| Collection `tz_report_definitions` | Fatto | Indice `workspaceId` + `updatedAt`; campi: `name`, `reportType`, `projectIds`, `dateFrom`/`dateTo`, audit `createdBy` |
| API CRUD (JWT) | Fatto | `GET/POST/PATCH/DELETE` sotto `/v1/report-definitions` (router intelligence); accesso workspace via `reports.read`; schema `ReportDefinition` in `openapi/openapi.v1.yaml` |
| UI salvataggio / riapertura | Fatto | Pagina **Report** → sezione «Preferiti salvati» (salva vista corrente, applica, elimina) |
| Condivisione link firmato report AI | Già presente | `POST /v1/reports/share` + lista/revoca (snapshot) |
| Audit letture link pubblico snapshot | Fatto (2026-04-02) | Ogni `GET /v1/public/reports/:token` con snapshot valido scrive `security.report_snapshot.accessed` su `tz_security_audit` (workspace, entityId = snapshotId, IP/UA se presenti) |
| Snapshot da preferito (senza LLM) | Fatto | `POST /v1/reports/share-definition` + pulsante «Link pubblico» su ogni preferito; esegue `runReport` sul tipo/filtri salvati e memorizza `snapshotKind: "definition"` in `tz_report_snapshots`; stesso URL pubblico `/v1/public/reports/:token` e pagina `/r/:token` |

## Prossimi passi

1. ~~Modello `tz_report_definitions`~~ → fatto.
2. ~~UI salvataggio/esecuzione report~~ → preferiti salvati; eventuale editor avanzato filtri.
3. ~~Audit accessi lettura snapshot pubblico~~ → fatto (vedi riga tabella).
4. ~~Condivisione statica da definizione salvata~~ → fatto (riga tabella).
5. AI opt-in centralizzato per workspace se serve governance aggiuntiva.
