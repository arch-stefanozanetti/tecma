# RBAC in produzione — checklist operativa

## Deploy backend

- Eseguire il deploy della versione che include `requirePermission` su comunicazioni, connettori, automazioni e intelligence, più l’eventuale aggiornamento di `BUILTIN_ROLE_PERMISSIONS`.

## MongoDB — allineamento definizioni ruolo

Sul server (stesse variabili d’ambiente del runtime: `MONGO_URI`, `MONGO_DB_NAME`, ecc.):

```bash
cd be-followup-v3
yarn migrate:role-definitions:reconcile
```

Aggiorna i documenti in `tz_roleDefinitions` con i permessi builtin mancanti senza rimuovere override custom.

## Token JWT e permessi

- I permessi nel **payload del JWT** sono quelli calcolati al **login** o al **refresh**.
- Dopo cambi ruolo/DB, gli utenti devono ottenere un **nuovo access token** (logout/login oppure refresh automatico se il client lo esegue).
- Il frontend salva uno snapshot `permissions` nello scope progetto e, con auth Followup, tenta un **refresh + `/me`** al massimo ogni 4 ore per allineare lo snapshot (vedi `App.tsx`).

## Verifica rapida

- Utente **collaborator**: deve poter usare Integrazioni (lettura/scrittura CRUD integrazioni) e Report (lettura) in linea con il builtin.
- Utente **viewer**: lettura integrazioni/report senza `integrations.update` (UI in sola lettura dove previsto).
- **Audit** e **inspect model-sample**: richiedono `settings.read` (tipicamente non incluso nel collaborator/viewer builtin).

## Webhook config API

Esposte su `be-followup-v3` con gli stessi permessi delle altre integrazioni:

- `GET /v1/workspaces/:workspaceId/webhook-configs` → `integrations.read`
- `POST /v1/workspaces/:workspaceId/webhook-configs` → `integrations.create` (body: campi come da servizio; `workspaceId` è preso dal path)
- `PATCH /v1/webhook-configs/:id` → `integrations.update`
- `DELETE /v1/webhook-configs/:id` → `integrations.delete`
