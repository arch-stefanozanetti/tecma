# Smoke manuale — staging / post-deploy (entitlement & Tecma)

Checklist **non automatizzata** da eseguire su un ambiente reale (staging o demo) dopo deploy o prima di un rilascio che tocca **workspace entitlement**, **console Tecma** o **report/integrazioni**.

Adatta URL, workspace e utenti di test al tuo ambiente.

## Prerequisiti

- Utente **Tecma admin** (dominio/flag coerenti con il backend).
- Utente **non Tecma** (solo admin workspace o ruolo normale).
- Almeno **due workspace** con configurazioni entitlement diverse (es. uno con report disabilitati a catalogo).

## Console Tecma

1. Accedi come **Tecma admin** → apri `/tecma/entitlements`.
2. Verifica che la **tabella moduli** si carichi e che il **cambio workspace** nel selettore ricarichi i dati senza errori in console.
3. Disconnetti (o usa sessione incognito) → accedi come **non Tecma** → apri `/tecma/entitlements`.
4. Atteso: messaggio di **accesso negato** (nessuna tabella entitlement).

## Report / API (403)

1. Su un workspace dove i report non sono abilitati (entitlement), con un JWT che includa `reports.read` (se applicabile al vostro modello), chiama ad esempio:
   - `POST /v1/reports/pipeline` (o l’endpoint equivalente nel vostro contract) con `workspaceId` e `projectIds` validi.
2. Atteso: **403** con codice **`FEATURE_NOT_ENTITLED`** (o equivalente documentato).

## Liste workspace (no leak)

1. Con utente senza accesso ad alcuni workspace, verifica che **GET elenco workspace** (o flusso UI) non esponga dati di workspace non autorizzati.

## Riferimenti

- Matrice e note di sicurezza: [plans/WORKSPACE_ENTITLEMENTS_MATRIX.md](plans/WORKSPACE_ENTITLEMENTS_MATRIX.md) (se presente nel repo).
- E2E automatizzati (mock + smoke API opzionale): [../fe-followup-v3/e2e/README.md](../fe-followup-v3/e2e/README.md).
