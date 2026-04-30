# Fase 7 — Contratto Inbox / notifiche

## Tipi attesi (Millennium / regole)

Esempi: `request_action_due`, `calendar_reminder`, `assignment`, `mention`, `other`. Le automazioni possono creare righe in `tz_notifications`.

## Contratto prodotto

1. **Generazione:** documentare per ogni tipo quale evento dominio o automazione lo crea.
2. **Empty state:** copy che spiega come arrivano le notifiche.
3. **Preferenze:** mute per tipo (persistenza utente).
4. **Navigazione:** ogni notifica linka sempre al contesto (cliente, trattativa, calendario).

## Verifica in codice

Allineare tipi FE con risposta `getNotifications` e OpenAPI quando si estende l’elenco.
