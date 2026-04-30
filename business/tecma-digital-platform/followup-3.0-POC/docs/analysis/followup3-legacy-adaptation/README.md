# Handoff pack — Followup 3.1 target da POC 3.0 e Legacy BSS

Questa cartella è il **pacchetto di handoff** per trasformare il POC Followup 3.0 in un target Followup 3.1 lavorabile dai team: analisi end-to-end (workspace/auth), matrice gap, spec operative (backend/dati/gateway), roadmap e runbook.

## Indice documenti

1. `00-context-and-constraints.md` — contesto, vincoli, baseline repo/contratti, note sync.
2. `01a-workspaces-first-analysis-followup-vs-bss-legacy.md` — sintesi chiara della prima analisi workspace (POC vs BSS legacy).
3. `01-workspace-deep-dive.md` — deep dive workspace/multi-tenant/assignments/session (POC).
4. `02-poc-vs-legacy-gap-matrix.md` — matrice gap API/dati/permessi + flussi auth/session.
5. `03-backend-adaptation-spec.md` — spec adattamento backend non distruttivo.
6. `04-data-adaptation-spec.md` — spec dati: legacy read/write source-of-truth + `tz_*` additive.
7. `05-api-contract-alignment-spec.md` — allineamento contratti gateway (merge OpenAPI + staging).
8. `06-delivery-roadmap-mvp-to-hardening.md` — roadmap MVP → hardening.
9. `07-implementation-ready-operational-pack.md` — **pacchetto lavorabile**: registro gap AS-IS/TO-BE con owner, runbook step-by-step, contratti REST minimi, matrice permessi, KPI, sicurezza/compliance, fasi con rollback/reconciliation, **DoR §8** (8 punti, incastro §9b/§9c/§9d), checklist QA, **DoD §9a**, **tracciabilità §9b**, **guardrail §9c**, **tipi di test §9d**.
10. `08-users-identity-accounts-and-lifecycle.md` — utenti `tz_users`, stati, multi-collection identity, edge case e backlog PO.
11. `09-rbac-permissions-enforcement-and-jwt.md` — `PERMISSIONS.*`, middleware, merge JWT con workspace, edge case.
12. `10-invites-tokens-email-and-set-password.md` — flusso invito end-to-end, token, email, **bug ordine consume/policy**, gap resend/revoke.
13. `11-bss-legacy-bridge-api-and-data-matrix.md` — **lettura obbligatoria per backend/BSS**: matrice funzione↔legacy↔azione (R/E/N/S), API nuove vs adapter, sequenze target, spike legacy, checklist DoR prima del codice.
14. `12-projects-workspace-users-and-permissions.md` — **creazione progetto**, **lista progetti per workspace**, join `tz_workspace_projects`, `projectId` JWT / `project_ids` utente, scope `tz_workspace_user_projects`, `requireCanAccessProject` e `workspaceId` query.

## Policy documentazione (pack)

- Gli arricchimenti restano **nei file elencati sopra** (e nei `_*.md` di baseline tecnica); **non** aprire nuovi capitoli come file separati se il contenuto può vivere in `07` (gate operativo) o nel documento di dominio già mappato (`08`–`12`, `02`, `05`, ecc.).
- Per backlog Jira: usare `07` §9a–§9b (DoD, matrice tracciabilità) come **fonte unica** da copiare nelle story, evitando duplicare intere specifiche in ticket lunghi senza link al pack.

## Executive summary (CTO)

- Il POC Followup 3.0 è una riscrittura greenfield di frontend, backend e database: dimostra un prodotto più pulito, ma implica una migrazione/cutover dal legacy.
- Il percorso conservativo richiesto dal CTO per Followup 3.1 è: domini legacy in read/write sul legacy/BSS; `tz_*` solo per capability additive o come projection controllata.
- Il percorso greenfield completo **non è approvato dal CTO** e non va presentato ai team come opzione di delivery. Può restare solo come contesto tecnico del POC e come benchmark di prodotto/UX.
- Il mondo **BSS legacy** è orientato a **login con `project_id`**, refresh e API `/v2/...` per progetto; il POC invece supporta **login senza progetto** e poi `session/projects-by-email`. Non è un dettaglio: impatta gateway, UX e threat model.
- La direzione operativa di questo pack è quindi **legacy-first**: rifare l'esperienza Followup 3.1 rispettando backend, dati e contratti legacy dove esistono.
- Esistono **gap funzionali** da chiudere prima di una GA: `access_scope` (UI/membership) non governa ancora completamente le liste; incoerenza potenziale tra lookup utente al login vs `projects-by-email` (`tz_users` hardcoded).
- **Backend e team BSS:** senza il ponte in `11-bss-legacy-bridge-api-and-data-matrix.md`, i file `08`–`10` rischiano di far intendere che basti replicare il POC su `tz_*`; per il target legacy-first serve invece la **matrice R/E/N/S** e gli output degli **spike** su API e persistenza legacy.

## Artefatti di baseline (2026-04-23)

File tecnici di baseline (commit/hash OpenAPI). Ciascuno include una sezione **«Uso nel pack Followup 3.1»** (ruolo, rigenerazione, riferimenti a `00`/`05`/`07`/`11`):

- `_baseline_git_2026-04-23.md`
- `_openapi_hashes_2026-04-23.md`
- `_openapi_recent_history_2026-04-23.md`

## Nota operativa (sync)

Il piano prevedeva uno sync GitLab “API-based”; in questa esecuzione il token API risultava **non valido**, quindi la baseline è stata consolidata con **git update mirati** e log in `/Users/s.zanetti/dev/tecma/_sync_logs/`. I contratti OpenAPI nel repo sono comunque “post-aggiornamento”, ma non garantiscono l’allineamento di *tutti* i repository del gruppo.

## Prossimi passi consigliati (azione umana)

0. **Backend / integrazione BSS:** leggere e completare le righe **S** (spike) in `11-bss-legacy-bridge-api-and-data-matrix.md` con consegne del team legacy (§3 di quel file).
1. Usare `07-implementation-ready-operational-pack.md` come **gate** prima di refinement: gap con owner, runbook e **DoR §8** (punti 1–8) compilati per lo sprint; in story: riga **§9b**, tipi test **§9d**, nota **§9c** (ok o eccezione approvata).
2. **Rigenerare PAT GitLab** e rieseguire lo script API-based (così la baseline diventa riproducibile).
3. Chiudere decisioni in `00`/`03`: `AUTH_MODE`, topologia Mongo e confini precisi tra domini legacy read/write e capability additive.
4. Aprire MR su `architecture/aws-api-gateway` per merge delle addizioni (`05`) e validazione Spectral, allineando i path di `07` §3 agli `operationId` e schemi OpenAPI.
