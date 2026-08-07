# `@followup/db` - baseline da adattare al database legacy

Questo package contiene il client Mongo e i repository importati dal POC. Lo
stato attuale include **`ensureCoreIndexes`**, con indici unici e TTL per le
collection `tz_*`: queste collection non rappresentano il target approvato dal
CTO.

- Gli indici sono definiti in `src/ensureIndexes.ts` e oggi vengono invocati
  all'avvio dell'API.
- Lo script `pnpm --filter @followup/api migrate:tz-collections` appartiene al
  POC e non deve essere eseguito sul database legacy.
- Prima del deploy, repository e bootstrap degli indici devono essere sostituiti
  o adattati allo schema legacy e revisionati insieme ai relativi test.

## Policy `_id` e chiavi documento

- **`_id`**: gli adapter devono rispettare il tipo realmente presente nel
  database legacy; non va assunto sempre `ObjectId`.
- **Nomi campo**: casing e alias devono seguire lo schema legacy. La forma usata
  dal POC non e una specifica per nuove collection.

## `tz_workspace_entitlements`

Collection e indice univoco `(workspaceId, feature)` sono predisposti nel POC
per un futuro modulo entitlements e oggi non sono referenziati dal runtime API.
Non devono essere creati sul database legacy senza una decisione architetturale
esplicita.
