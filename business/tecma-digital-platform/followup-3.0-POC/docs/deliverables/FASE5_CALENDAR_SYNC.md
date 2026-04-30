# Fase 5 — Calendario unificato + sync reale

## Stato implementazione (repo, 2026-04-14)

**Outlook (Microsoft Graph)**

- **BE:** `outlook.service` — OAuth, `tz_connector_credentials`, `GET /v1/connectors/outlook/status`, `GET /v1/connectors/outlook/calendar/events`, callback pubblico per token.
- **FE:** Integrazioni — connessione Outlook; **Calendario** — avviso se account non collegato (link a Integrazioni); caricamento unificato con `queryCalendar` + merge in griglia di eventi Graph come `source: OUTLOOK` (sola lettura, link “Apri in Outlook” se presente `webLink`).

**Ancora da backlog (per chiudere il tema “sync reale” end-to-end)**

- **Gmail** (o equivalente) oltre Outlook, se in scope prodotto.
- **Sync incrementale / job** e gestione **refresh token** (cifratura, rotazione, errori scope) oltre al flusso OAuth già presente.
- **Unificazione scrittura** eventi CRM da tutte le UI verso una sola sorgente dominio (vedi sotto).

## Modello dominio

Una sorgente eventi (es. `tz_events` o collection consolidata) con `clientId`, `apartmentId`, `requestId`; creazione da CalendarPage e timeline → stesso documento.

## Sync esterni (obiettivi residui)

- Completare integrazione **Gmail** dove previsto da roadmap.
- Refresh token cifrati per workspace/utente; sync incrementale; gestione errori e scope minimi oltre baseline Outlook.

## Ordine suggerito

1. Unificare scrittura eventi da tutte le UI.
2. Aggiungere provider OAuth + job sync (estensione oltre slice Outlook).
3. Parità comportamento vs legacy Followup (funzionale, non UI 1:1).
