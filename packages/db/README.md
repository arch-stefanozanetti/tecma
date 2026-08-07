# `@followup/db` - data layer greenfield

Questo package contiene il client Mongo, i repository e gli indici del modello
greenfield `tz_*`. `test-zanetti` e il database temporaneo usato per validare il
modello; il database definitivo verra creato in una fase successiva.

- Gli indici sono definiti in `src/ensureIndexes.ts` e oggi vengono invocati
  all'avvio dell'API.
- Lo script `pnpm --filter @followup/api migrate:tz-collections` puo essere
  eseguito soltanto su un database greenfield autorizzato.
- Nessun client o repository runtime deve collegarsi ai database legacy.
- Il modello definitivo verra consolidato prima della migrazione offline dei
  dati legacy.

## Policy `_id` e chiavi documento

- **`_id`**: il modello canonico deve definire esplicitamente il tipo per ogni
  aggregate; il supporto misto attuale e solo compatibilita transitoria.
- **Nomi campo**: casing, date e riferimenti devono convergere su una convenzione
  greenfield unica prima della creazione del database definitivo.

## `tz_workspace_entitlements`

Collection e indice univoco `(workspaceId, feature)` sono predisposti per il
modulo entitlements e oggi non sono referenziati dal runtime API. Prima del
database definitivo va confermato se gli entitlement sono configurazione,
stato commerciale o entrambi.
