# Backlog: migrazione calendario legacy → `tz_calendar_events`

## Stato attuale

Lo script [`be-followup-v3/scripts/migration/migrate-legacy-pilot.ts`](../../be-followup-v3/scripts/migration/migrate-legacy-pilot.ts) **non** importa eventi di calendario. Le trattative, clienti, appartamenti, preventivi e richieste sono coperte; il calendario operativo in Followup 3.0 usa `tz_calendar_events` (vedi seed e servizi calendar nel backend).

## Obiettivo (fase successiva)

1. **Individuare la sorgente legacy** (database + collection + forma documenti: riferimento a `project_id`, `client_id`, utente, range date, ricorrenze se presenti).
2. **Definire mapping** verso lo schema `tz_calendar_events` (campi obbligatori, `workspaceId`, `projectId`, permessi).
3. **Script ETL dedicato** (o estensione controllata del pilot) con upsert idempotente su chiave `(legacySourceDb, legacyCollection, legacyId)` coerente con le altre entità.
4. **Validazione**: confronto conteggi per progetto e spot-check date/orari in UI Calendario.

## Note

- Evitare duplicati se gli stessi eventi sono già stati creati manualmente in `test-zanetti`.
- Allineare policy GDPR se gli eventi contengono dati personali collegati a clienti.
