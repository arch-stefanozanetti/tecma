# `@followup/db`

Client Mongo, repository di base e **`ensureCoreIndexes`**: indici unici e TTL per le collection `tz_*` usate da Followup 3.0.

- Indici definiti in `src/ensureIndexes.ts` (invocato all’avvio API).
- Migrazione indici offline: `pnpm --filter @followup/api migrate:tz-collections` (dry-run di default, `--apply` per eseguire). Opzionale: `--with-validators` con `--apply` per `collMod` JSON Schema (azione `warn`, livello `moderate`).

## Policy `_id` e chiavi documento

- **`_id`**: MongoDB genera ObjectId se non fornito; in alcuni flussi legacy o di integrazione `_id` può essere una **stringa UUID** o un altro identificativo stabile. Le query devono usare il tipo effettivamente persistito (non assumere sempre ObjectId).
- **Campi `camelCase` vs `snake_case`**: le collection nuove tendono a `camelCase` (`workspaceId`, `userId`). Restano campi **legacy** in `snake_case` dove indicizzati esplicitamente (es. `owner_user_id` su `tz_workspaces`, `project_id` su `tz_project_access`). I nuovi documenti preferiscono la forma coerente col codice TypeScript.

## `tz_workspace_entitlements`

Collection e indice univoco `(workspaceId, feature)` sono **predisposti** per un futuro modulo entitlements; oggi non è referenziata dal runtime API. Non rimuovere l’indice senza decisione architetturale esplicita.
