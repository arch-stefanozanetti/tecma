# Fase 4 — Report, dashboard, AI

## Obiettivi

- Definizioni report persistite ed esecuzione aggregata (query parametrizzate).
- Dashboard condivisibili: token read-only scoped (stesso pattern del preventivo).
- AI: opt-in, chiave/config per workspace; nessuna chiamata LLM senza setup esplicito.

## Integrazione esistente

- Platform API: `POST /v1/platform/reports/kpi-summary` (KPI minimi) con API key.

## Prossimi passi

1. Modello `tz_report_definitions` (nome, query, filtri, permessi).
2. UI salvataggio/esecuzione report.
3. Condivisione link firmato + audit accessi.
