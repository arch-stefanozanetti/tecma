# Audit eventi di autenticazione (Wave 6)

Gli eventi di login, logout e SSO exchange vengono registrati in una collection dedicata per audit e sicurezza.

## Collection: `tz_authEvents`

- **Database:** stesso DB del backend Followup (es. `MONGO_DB_NAME`).
- **Documenti:** un documento per evento, con i campi:
  - `eventType`: `"login"` | `"logout"` | `"sso_exchange"`
  - `userId`: ID utente (stringa, da collection utenti legacy)
  - `email`: email utente (se disponibile)
  - `at`: data/ora dell’evento (ISO)

Solo gli eventi **riusciti** vengono tracciati. I login falliti non sono registrati in questa collection (per evitare volumi elevati e abusi; eventuali log applicativi restano in console/servizi di log).

## Uso consentito

- **Sicurezza:** individuare accessi anomali, sessioni duplicate, logout di massa.
- **Compliance:** dimostrare chi ha effettuato l’accesso e quando (su richiesta di audit).
- **Supporto:** correlare problemi segnalati dagli utenti con sessioni e orari di accesso.

Non usare questa collection per analytics di prodotto o profilazione; contiene solo dati minimi (userId, email, tipo evento, timestamp).

## Retention e manutenzione

- **Retention consigliata:** 90–365 giorni a seconda della policy aziendale. Oltre un anno i dati possono essere archiviati o eliminati.
- **Manutenzione:** è possibile creare un job periodico (cron o script) che elimina documenti con `at` precedente alla soglia (es. 1 anno). Esempio di query per cancellazione:
  ```js
  db.tz_authEvents.deleteMany({ at: { $lt: new Date(Date.now() - 365*24*60*60*1000) } })
  ```
- **Indici:** per query per utente o per intervallo temporale è utile un indice:
  ```js
  db.tz_authEvents.createIndex({ userId: 1, at: -1 })
  db.tz_authEvents.createIndex({ at: -1 })
  ```

## Riferimenti

- Implementazione: `be-followup-v3/src/core/auth/authAudit.service.ts`
- Chiamate: `auth.service.ts` (login, exchangeSsoJwt, logoutWithRefreshToken)
- Wave 6: [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md) — Task 3 Audit e policy
