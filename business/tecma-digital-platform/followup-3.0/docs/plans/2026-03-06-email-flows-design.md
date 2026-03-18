# Design: gestione mail da interfaccia (Followup 3.0)

**Stato:** implementato. Collection `tz_email_flows`, API admin, UI Impostazioni email, fallback template codice se `enabled: false` o template invalido.

## Modello

- `flowKey`: `user_invite` | `password_reset` | `email_verification`
- `enabled`, `subject`, `bodyHtml`, `updatedAt`, `updatedBy`

## Comportamento

- `enabled === false` o assenza doc → template default da codice.
- `enabled === true` e sostituzione `{{var}}` completa → invio custom.
- Placeholder non risolti → fallback default.

## Permessi

- `email_flows.manage` (admin con `*`).
