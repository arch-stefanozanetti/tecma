# Audit autenticazione, accesso e mutazioni (MDOO / Wave 6+)

## Collection: `tz_authEvents`

- **Database:** stesso DB del backend Followup (`MONGO_DB_NAME`, es. `test-zanetti`).
- **Scopo:** traccia eventi di autenticazione e sicurezza.

### Campi (schema evoluto)

| Campo | Descrizione |
|-------|-------------|
| `eventType` | Tipo evento (stringa). Valori tipici: `login_success`, `login_failed`, `logout`, `sso_exchange`, `password_reset_requested`, `password_reset_completed`, `invite_accepted`. Legacy: `login` (alcuni flussi vecchi). |
| `userId` | ID utente quando noto (manca su login fallito con email sconosciuta). |
| `email` | Email normalizzata quando disponibile. |
| `at` | Timestamp evento. |
| `ipAddress` | IP client (se disponibile; es. da `X-Forwarded-For`). |
| `userAgent` | User-Agent della richiesta. |
| `success` | `true`/`false` dove applicabile. |

**Non** registrare password, token di refresh, JWT completi o header `Authorization` in chiaro.

### Uso consentito

- Sicurezza (tentativi falliti, reset password, inviti accettati).
- Compliance e supporto (correlazione accessi).

### Retention

Come da policy aziendale (es. 90–365 giorni). Esempio pulizia:

```js
db.tz_authEvents.deleteMany({ at: { $lt: new Date(Date.now() - 365*24*60*60*1000) } })
```

Indici utili: `{ userId: 1, at: -1 }`, `{ at: -1 }`, `{ eventType: 1, at: -1 }`.

---

## Collection: `tz_accessLogs`

- Una riga per richiesta HTTP su `/v1` (middleware access logger).
- Campi tipici: `userId`, `endpoint`, `method`, `projectId`, `statusCode`, `responseTimeMs`, `ipAddress`, `createdAt`.
- **Retention:** in ambienti ad alto traffico valutare TTL Mongo o campionamento.

---

## Collection: `tz_auditLogs`

- Audit **mutazioni** su entità critiche (es. invito utente, update/delete utente).
- Campi: `userId` (attore), `action`, `entityType`, `entityId`, `changes` (before/after JSON), `projectId`, `createdAt`.
- Non includere segreti nei `changes`.

---

## Riferimenti implementazione

- Auth events: `be-followup-v3/src/core/auth/authAudit.service.ts`
- Access log: `be-followup-v3/src/core/audit/accessLog.service.ts`
- Entity audit: `be-followup-v3/src/core/audit/audit.service.ts`
- Chiamate login/logout/reset/invite: `auth.service.ts`, `users-mutations.service.ts`, route `v1/public.routes.ts` e `v1.ts`
