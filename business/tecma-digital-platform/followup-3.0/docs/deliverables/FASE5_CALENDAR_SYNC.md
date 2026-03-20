# Fase 5 — Calendario unificato + sync reale

## Modello dominio

Una sorgente eventi (es. `tz_events` o collection consolidata) con `clientId`, `apartmentId`, `requestId`; creazione da CalendarPage e timeline → stesso documento.

## Sync esterni

- Sostituire mock Gmail/Outlook con OAuth reale.
- Refresh token cifrati per workspace/utente; sync incrementale; gestione errori e scope minimi.

## Ordine suggerito

1. Unificare scrittura eventi da tutte le UI.
2. Aggiungere provider OAuth + job sync.
3. Parità comportamento vs legacy Followup (funzionale, non UI 1:1).
