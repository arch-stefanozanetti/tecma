# Spike — Consensi GDPR: progetto vs workspace

**Scopo:** decidere **prima** del carico massivo clienti se i dati possono essere trattati solo come **progetto** (come nel legacy) o anche come **workspace**, e se serve **re-consent** o limitazioni di visibilità.

**Non è solo una decisione tecnica:** coinvolgere **DPO / legale**; riferimento alto livello: [05-privacy-gdpr-and-tenant-model.md](../executive/05-privacy-gdpr-and-tenant-model.md).

---

## Contesto

- Nel legacy i **clienti** erano spesso legati al **progetto**.
- In FollowUp 3.0 il cliente è **`tz_clients`** con **`workspaceId`** + **`projectId`** (scope CRM) — vedi [`clients.service.ts`](../../be-followup-v3/src/core/clients/clients.service.ts).
- Se il consenso privacy era raccolto **solo per il progetto** e non per l’organizzazione (workspace), **estendere** visibilità o finalità senza nuova base giuridica può essere **non conforme**.

Evidenza dati legacy (`client.clients`):

- presenti flag legacy `trattamento`, `profilazione`, `marketing`
- presente struttura `privacyInformation` versionata per timestamp (snapshot storico delle policy accettate)

Questo implica che lo spike deve definire la regola di porting **storico consensi** (non solo stato booleano corrente).

---

## Domande da rispondere (checklist)

| # | Domanda | Esito / azione |
|---|---------|----------------|
| 1 | Il testo privacy legacy menziona il **brand progetto** o la **società** che oggi gestisce il workspace? | |
| 2 | Il trasferimento nel nuovo CRM è **stesso titolare** / stesso trattamento o **cambio** di finalità? | |
| 3 | Serve **banner / email** di re-consent per alcuni segmenti? | |
| 4 | Possiamo **importare** solo clienti con flag di consenso valido mappabile? | |
| 5 | Come gestiamo **export** e **cancellazione** a livello workspace (diritti) vs progetto? | |

---

## Opzioni tecniche (da sottoporre al legale)

| Opzione | Descrizione | Pro | Contro |
|---------|-------------|-----|--------|
| **A** | Import con `workspaceId` + metadata `consentScope: "project"` e limitazioni permessi | Rispetta confini iniziali | Complessità RBAC/report |
| **B** | Campagna re-consent post-migrazione prima di abilitare funzioni workspace-wide | Chiarimento per utenti finali | Tempo e UX |
| **C** | Solo progetti selezionati per primo cutover | Riduce rischio | Più ondate di migrazione |

---

## Output atteso dello spike

1. **Decisione** registrata (email / verbale / Confluence) con riferimento a questa tabella.
2. Aggiornamento eventuale campi su `tz_clients` o policy documentata in [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md) (riga consensi GDPR).
3. Allineamento con [PILOT_ETL_RUNBOOK.md](./PILOT_ETL_RUNBOOK.md): criteri di inclusione record nel carico.
