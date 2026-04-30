# Workflow Hard Cut - Runbook (test DB)

## Prerequisiti
- Ambiente test con variabili `MONGO_URI` e `MONGO_DB_NAME`.
- Workflow configurati per workspace/progetto prima della pulizia.

## Esecuzione
Dal backend:

```bash
npm run cleanup:workflow-legacy-hard-cut
```

## Cosa fa lo script
- Normalizza `tz_requests.workflowId` e `tz_requests.currentStateId`.
- Elimina richieste senza workflow risolvibile.
- Elimina richieste con `status` non mappabile a uno stato workflow.
- Elimina transizioni orfane (`tz_request_transitions`) delle richieste cancellate.
- Elimina override progetto con `workflowId` non valido.
- Elimina lock appartamento orfani (`workflowStateId` non valido).

## Output atteso
Lo script stampa un riepilogo con conteggi di:
- richieste normalizzate
- richieste cancellate
- transizioni cancellate
- override progetto rimossi
- lock orfani rimossi
