# Runbook: ambienti dev1, demo, produzione (Followup 3.0)

## Principio

La **promozione delle funzionalità** tra ambienti avviene tramite **deploy del codice** (e DB separati per istanza). I **flag per workspace** nel codice controllano chi può usare cosa **dentro** un ambiente già deployato.

## Ordine consigliato

1. **Dev1** — integrazione continua: ogni merge sulla linea principale può deployare qui per validazione.
2. **Demo** — promozione esplicita (tag, branch `release/*`, o job manuale) quando le feature sono pronte per stakeholder / UAT.
3. **Prod** — promozione solo dopo checklist (test, smoke, backup DB se serve migrazione).

```text
dev1 → (approvazione) → demo → (approvazione) → prod
```

## Render / variabili

- Ogni ambiente ha **servizi BE/FE** distinti e **`MONGO_DB_NAME` / `MONGO_URI`** coerenti (nessun DB condiviso tra demo e prod salvo eccezione documentata).
- Allineare `APP_ENV` / URL pubblici al contesto (vedi `.env.example` e `render.yaml` nel repo `tecma`).

## Rollback

- **Deploy**: ripristinare il commit precedente sul servizio interessato e ridistribuire.
- **Dati**: eventuali script di migrazione devono avere piano di rollback o essere idempotenti.

## Riferimenti

- Design feature flags: [2026-03-21-feature-flags-workspace-design.md](./2026-03-21-feature-flags-workspace-design.md)
- Entitlement: [../deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md](../deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md)
