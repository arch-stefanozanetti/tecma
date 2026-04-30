# Followup 3.1 — Pacchetto operativo (processo, sicurezza, flussi)

Questo documento rende **lavorabile senza ambiguità** quanto descritto in `00`–`06` e in `01a`: registro gap con owner, runbook, contratti REST minimi, matrice permessi, KPI, checklist sicurezza/compliance, piano a fasi con rollback e reconciliation.  
È pensato per **steering**, **refinement** e **Definition of Ready** delle story Jira TECMA.

**Principi non negoziabili (3.1)**

- Domini legacy (clienti, appartamenti, richieste, progetti, utenti dove coperto dal legacy): **read/write sul legacy** tramite BSS/servizi approvati, nessun CRM parallelo non governato.
- Workspace, membership, scope progetto per utente nel workspace, inviti workspace-oriented dove non esiste equivalente legacy: **layer additive** (`tz_*` o equivalente approvato), allineato agli ID legacy dove serve join.
- **REST-only**, niente GraphQL; errori e success coerenti con standard TECMA (`data`, `ErrorResponse` dove applicabile al gateway).

**Perimetro strategico da ribadire prima dello sprint**

Questo runbook assume il percorso **legacy-first**, che è il target approvato dal CTO. Il POC greenfield resta riferimento funzionale/UX, non target dati o proposta di delivery.

---

## 1) Registro gap — AS-IS → TO-BE con owner

Legenda priorità: **P0** bloccante release, **P1** alto, **P2** medio.  
Owner: **PO**, **BE**, **FE**, **Platform** (gateway/infra), **Security**, **QA**.

| ID | AS-IS (POC / oggi) | TO-BE (3.1 target) | Owner | P | Bloccante se ignorato |
|----|--------------------|--------------------|-------|---|------------------------|
| G-AUTH-01 | Due mondi auth: login Followup senza `project_id` vs BSS `/login` con `project_id` | Una strategia primaria documentata (`bss-first` / `hybrid` con bridge approvato); secondaria solo se Security firma | Security + BE + PO | P0 | Token errati, accessi incrociati, impossibilità audit |
| G-AUTH-02 | Refresh opaco `tz_authSessions` vs refresh BSS | Allineamento a modello sessioni **approvato** (legacy/BSS o store dedicato); nessun doppio refresh non governato | BE + Security | P0 | Session fixation, logout incompleto |
| G-ID-01 | `tz_user_workspaces.userId` = email (Fase 1); lookup utente multi-collection vs `tz_users` hardcoded in alcuni flussi | Fonte canonica identità + piano migrazione email→id stabile + reconciliation | BE + PO + QA | P0 | Membership errata, inviti persi, duplicati |
| G-WS-01 | Invito utente (`POST /users` + token) **non** crea membership workspace | Flusso prodotto definito: invito → accettazione → membership (atomico o compensato) + stati UX | PO + BE + FE | P0 | Utenti “orfani” senza workspace |
| G-WS-02 | Associazione workspace↔progetto e scope utente↔progetto descritte ma senza runbook unico | Runbook §2 + idempotenza API §3 | BE + QA | P1 | Progetti sbagliati, scope inconsistente |
| G-ACL-01 | `access_scope` non applicato ovunque alle liste | Stessa regola su clients/apartments/requests (+ calendar se in scope) | BE + QA | P0 | Data leak tra utenti workspace |
| G-API-01 | Endpoint candidati senza contratto backlog-ready | Contratti minimi §3 + OpenAPI in MR gateway | BE + Platform | P1 | FE/contract drift, CI Spectral fallita |
| G-OPS-01 | Scritture legacy senza tracciamento operativo | Write solo percorsi approvati; audit con `workspaceId` / `projectId` / actor | BE + Security | P0 | Compliance, incident response impossibile |
| G-QA-01 | Test “a sentimento” | Matrice test §9 + dataset campione | QA + BE | P1 | Regressioni auth/workspace |
| G-STRAT-01 | Ambiguità tra POC greenfield e target 3.1 | Decisione ribadita: legacy-first per 3.1; POC usato come riferimento funzionale/UX, non come target dati | CTO + PO + Engineering | P0 | Team implementano assunzioni dati incompatibili |

**Criterio di chiusura per riga**: owner firma checklist in §9 (o ticket figlio) con link a PR/MR e prova in staging.

---

## 2) Runbook operativi (step-by-step)

Convenzioni: **200** successo con body `{ "data": ... }`; errori **401/403/404/409/422/429/500** con `ErrorResponse` (code, message, status, opzionale tId, details).  
Tutti gli endpoint protetti: `Authorization: Bearer`, `x-api-key` ove richiesto dal gateway.

### 2.1 Invitare utente e agganciarlo al workspace

**Precondizioni**

- Actor è **admin** workspace (o ruolo con permesso esplicito inviti, da allineare al RBAC finale).
- Email non già vincolata a conflitto identità irrisolvibile (policy definita in G-ID-01).
- Workspace `W` esiste; almeno un progetto `P` associato a `W` se l’onboarding richiede contesto progetto.

**Happy path (ordine consigliato per evitare orfani)**

1. **Creare invito workspace-scoped** (TO-BE): `POST /v1/workspaces/{workspaceId}/invites` con body `{ "email", "role", "projectIdsOptional": [] }` → `201`, `data.inviteId`, scadenza, stato `pending`.  
   - *Oggi POC*: usare equivalente combinazione `POST /users` + poi membership; finché non c’è API unica, runbook interno deve vietare chiusura ticket senza passo 4.
2. Utente riceve link con **token opaco monouso** (hash lato server, TTL definito da Security).
3. `POST /v1/auth/set-password-from-invite` (o endpoint unificato TO-BE) con `{ "token", "password" }` → `200`, utente `active`.
4. **Agganciare membership**: `POST /v1/workspaces/{workspaceId}/users` con `{ "userId": "<canonicalUserId>", "role" }` → `200`/`201`.  
   - Se userId ancora email in transizione: documentare esplicitamente nel ticket fino a cutover G-ID-01.
5. Opzionale: `PATCH .../users/{userId}` con `access_scope` se diverso da default.
6. Verifica: `GET /v1/workspaces` filtrato mostra `W` per l’utente; `GET /v1/workspaces/{id}/users` contiene l’utente.

**Errori attesi (UX + BE)**

| HTTP | code (esempio) | Azione operativa |
|------|----------------|------------------|
| 409 | `InviteEmailConflict` | Non creare doppio invito; mostrare “account esistente” e flusso “aggiungi a workspace” |
| 410 / 404 | `InviteExpired` / `InviteNotFound` | Rinviare invito con audit; rate limit su rinnovi |
| 422 | `ValidationError` | Correggere input; log strutturato senza password |
| 429 | `RateLimited` | Backoff; monitoraggio abusi |

**Rollback / compensazione**

- Se passo 4 fallisce dopo attivazione utente: **non** lasciare utente senza membership se la policy è “workspace obbligatorio”: queue di retry o transazione saga (stato `pending_membership` su invito) — decisione BE da formalizzare in ADR.

### 2.2 Associare workspace a progetto (e viceversa)

**Precondizioni**

- `projectId` esiste nel **legacy** ed è valido per l’organizzazione (verifica BSS o servizio progetti).
- Actor può gestire workspace (admin/owner).

**Happy path**

1. `POST /v1/workspaces/projects/associate` (o `POST /v1/workspaces/{workspaceId}/projects` TO-BE) con `{ "workspaceId", "projectId" }` → `201` / `200`.
2. Verifica: `GET /v1/workspaces/{workspaceId}/projects` contiene `projectId`.
3. Se policy richiede allineamento ruoli legacy: chiamata BSS/legacy documentata (owner BE) per coerenza permessi progetto.

**Errori**

- **409** se già associato (idempotente: stesso body → 200 con flag `alreadyLinked` opzionale in `data`).
- **403** se progetto non assegnabile all’actor.
- **404** workspace o progetto inesistente.

**Rollback**

- `DELETE /v1/workspaces/{workspaceId}/projects/{projectId}` → verificare impatto su `tz_workspace_user_projects`: policy “cascade delete” o blocco con messaggio (definire in story).

### 2.3 Assegnare scope progetti all’utente nel workspace

**Precondizioni**

- Utente è membro di `workspaceId`.
- `projectId` è tra i progetti associati al workspace.

**Happy path**

1. `POST /v1/workspaces/{workspaceId}/users/{userId}/projects` con `{ "projectId" }` oppure **replace bulk** TO-BE: `PUT` con `{ "projectIds": ["..."] }` (preferito per ridurre race).
2. Verifica: `GET .../users/{userId}/projects` coerente con atteso.
3. Se `access_scope=assigned`: verificare che liste clients/apartments rispettino §4 (test QA).

**Rollback**

- DELETE singolo progetto dallo scope o replace con lista precedente (audit before/after obbligatorio per operazioni bulk).

---

## 3) Contratti REST minimi (backlog-ready)

Path esemplificativi sotto dominio Followup; versionamento `/v1/` come da linee guida TECMA per nuove API.  
**Tutte le risposte 200** con payload sotto `data`. Errori: wrapper `error` con `code`, `message`, `status`.

### 3.1 `POST /v1/workspaces/{workspaceId}/invites`

**Request** (JSON):

```json
{
  "email": "user@example.com",
  "role": "collaborator",
  "projectScope": { "mode": "all_in_workspace", "projectIds": [] },
  "message": "optional",
  "locale": "it-IT"
}
```

**Response 201**

```json
{
  "data": {
    "inviteId": "64a1f2...",
    "workspaceId": "64b3...",
    "email": "user@example.com",
    "status": "pending",
    "expiresAt": "2026-04-30T12:00:00Z"
  }
}
```

**Errori**: `401`, `403`, `404` (workspace), `409` (conflitto email/invito attivo), `422`, `429`, `500`.

### 3.2 `GET /v1/workspaces/{workspaceId}/invites`

Query: `page`, `perPage`, `sortField`, `sortOrder`, filtri `status`, `email` (opzionali).  
**Response 200**: `data` array + `paginationInfo` (campi obbligatori TECMA).

### 3.3 `POST /v1/workspaces/{workspaceId}/invites/{inviteId}/resend` / `POST .../revoke`

- **Resend**: `200`, idempotenza con limite rate (Security).
- **Revoke**: `200`, `data.status = "revoked"`; token non più accettabile.

### 3.4 `PUT /v1/workspaces/{workspaceId}/users/{userId}/projects`

**Request**

```json
{
  "projectIds": ["proj1", "proj2"]
}
```

**Response 200**: `data` con lista finale e `updatedAt`.  
**Errori**: `409` se `projectIds` contiene progetto non associato al workspace.

> Nota implementazione: allineare `operationId` camelCase e descrizioni/esempi in OpenAPI per passare Spectral (`architecture/aws-api-gateway`).

---

## 4) Matrice permessi (membership × `access_scope` × dominio)

Assunzione: **admin/owner** bypassano filtri assignment dove la policy prodotto lo richiede (da validare con PO).  
**collaborator/viewer**: rispettano `access_scope`.

| Ruolo | access_scope | Clients | Apartments | Requests | Calendar | Impostazioni workspace | Inviti / membership |
|-------|----------------|---------|------------|----------|----------|------------------------|----------------------|
| owner | all | CRUD legacy via BSS | CRUD legacy via BSS | CRUD legacy via BSS | CRUD se in scope | CRUD | CRUD |
| owner | assigned | CRUD **solo** entità assegnate (+ stessa per read) | idem | idem | idem | CRUD | CRUD |
| admin | all | come owner (se prodotto equipara) | idem | idem | idem | CRUD | CRUD |
| admin | assigned | filtro assignment | idem | idem | idem | CRUD | CRUD |
| collaborator | all | read/write legacy secondo permessi stringa PERMISSIONS | idem | idem | idem | read limitato | no inviti (default) |
| collaborator | assigned | solo assegnate | idem | idem | idem | read limitato | no |
| viewer | all | read | read | read | read | read | no |
| viewer | assigned | read solo assegnate | idem | idem | idem | read | no |

**Azione obbligatoria**: chiudere con PO se **viewer** può vedere metadata senza assignment quando `assigned` (oggi gap noto sulle liste).

---

## 5) KPI e criteri di successo (prodotto + operativi)

| KPI | Definizione | Target iniziale (esempio) | Owner misura |
|-----|-------------|---------------------------|--------------|
| Tempo onboarding admin | da creazione invito a utente attivo + membro workspace | p95 < X minuti (definire X con baseline) | PO + QA |
| Tasso completamento invito | inviti `accepted` / inviti `sent` in finestra | > Y% | PO |
| Error rate inviti | 4xx/5xx su endpoint invito / set-password | < Z% su traffico reale | Platform + BE |
| Incidenti accesso | ticket P1/P0 “utente vede dati altrui” | 0 in staging pre-prod | Security + QA |
| Coerenza scope | mismatch tra `tz_workspace_user_projects` e liste CRM | 0 su campione N progetti | QA |

---

## 6) Sicurezza e compliance — rischi e mitigazioni

| Rischio | Mitigazione minima |
|---------|-------------------|
| Token invito enumerabile | token lungo random, solo **hash** in DB, TTL corto, un solo uso, rate limit su set-password |
| Inviti rinviati in loop | limite resend/giorno, audit, alert su anomalie |
| Utente disabilitato ma sessione attiva | policy revoca refresh/JWT blacklist o versione `tokenVersion` su user; test automatico |
| Privilege escalation su `role` membership | solo admin/owner workspace; audit obbligatorio; test 403 |
| Data leak cross-workspace (ACL) | enforcement `access_scope` + test regressione §9 |
| Log con PII eccessive | mascherare email in log applicativi; retention policy |
| Scrittura legacy non tracciata | correlation id (tId) end-to-end; audit campi actor/workspace/project |

Security firma **threat model** di 1 pagina su: inviti, refresh, proxy gateway verso Followup.

---

## 7) Piano a fasi — adozione, rollback, reconciliation

### Fase 0 — Decisioni (1 sprint max)

Output: ADR su auth, identità, ownership DB. **Rollback**: nessun rilascio utente.

### Fase 1 — Dual-read / compat (transizione email → id)

- Scrittura nuove membership con **id stabile** dove possibile; lettura accetta email **o** id.
- Job reconciliation notturno: riporta discrepanze in report (owner QA).  
**Rollback**: feature flag `USE_STABLE_USER_ID=false`.

### Fase 2 — Cutover inviti + membership atomici

- API `.../invites` + stato `pending_membership` o saga documentata.  
**Rollback**: disattivare route nuove a gateway; ripristino runbook POC documentato (solo emergenza).

### Fase 3 — Hardening

- Rimuovere lettura per email dove non serve; indici e performance; pen test leggero su inviti.

**Reconciliation continua**

- Confronto periodico: membri workspace vs utenti legacy attivi per `projectId`; dashboard operativa (owner Platform).

---

## 8) Definition of Ready (DoR) per story workspace/auth

Una story non entra in sprint se manca almeno uno di:

1. AS-IS / TO-BE riga nel registro §1 (o link a gap ID).
2. Owner (BE/FE/…) e dipendenze Security/Platform se tocca token o gateway.
3. Contratto API (anche solo sezione §3 copiata nello story description) + codici errore.
4. Almeno **3** acceptance test QA (happy + 2 edge) tracciati **con ID** (stessa riga della matrice §9b, vedi sotto).
5. Piano rollback o feature flag nominato.
6. **Tracciabilità §9b**: almeno una riga compilata (ID req, fonte pack §/doc, tipo test, ID test/caso QA — stato può restare “da fare” ma la riga non deve essere vuota).
7. **Allineamento tipi di test §9d**: indicato esplicitamente quali colonne della tabella §9d si intendono coprire (es. “API integrazione BE + E2E UI”); se la story tocca solo BE, giustificare in descrizione perché E2E non serve in quel slice.
8. **Guardrail §9c**: lettura e conferma in refinement che nessun punto §9c è violato senza ADR o eccezione Security (basta checkbox in story o commento “§9c ok / eccezione X approvata da …”).

**Nota:** §9a (DoD release) è **successivo** allo sprint (chiusura in release); in DoR si usa §9a come **anticipo**: se è ovvio che una story non potrà mai soddisfare §9a (es. manca audit richiesto), la story non è ready — va spezzata o integrata prima un prerequisito.

---

## 9) Checklist QA gate (pre-merge / pre-release)

- [ ] Auth: login e refresh secondo strategia scelta; nessun token “orfano” dopo logout.
- [ ] Invito: scaduto, già usato, revocato, email duplicata.
- [ ] Membership: non-member riceve **403** su risorse workspace.
- [ ] `access_scope=assigned`: utente **non** vede record non assegnati su clients **e** apartments (minimo).
- [ ] Scope progetti: DELETE progetto da workspace gestisce utenti con scope (comportamento documentato).
- [ ] Audit: eventi invito/membership/scope con actor e workspaceId.
- [ ] Rate limit: login, invite, resend.
- [ ] Gateway: path esposti allineati a OpenAPI; `yarn lint:domain` ok su dominio interessato.

### 9a) Definition of Done (DoD) — release slice workspace/auth

Oltre al DoR §8, una story/feature che tocca workspace, inviti o token non è “done” per release se manca almeno uno dei seguenti:

1. **Evidenzia di test**: esito positivo in staging (log o report allegato alla story / pipeline) per i casi §9 pertinenti.
2. **Rollback verificato**: feature flag o route disattivabile documentata; smoke post-rollback eseguito o schedulato entro 24h.
3. **Audit / correlazione**: per mutazioni membership/invito/progetto-workspace, evento con `workspaceId` e actor (vedi `10` §5, `12` §6).
4. **Security self-check**: nessun segreto in log; token invito solo hash at-rest; rate limit coerente con `03` §Rate limit.
5. **Contratto**: OpenAPI merged o MR aperta con link; nessun errore Spectral **error** sui path nuovi/modificati (`05`).

### 9b) Tracciabilità requisito → documento → test (template)

Usare una tabella (copiabile in Jira “Supporting Material” o Confluence) per ogni epica workspace/auth. Esempio di colonne:

| ID req | Descrizione sintetica | Fonte pack (§/doc) | Tipo test (E2E / API / unit) | ID test / caso QA | Stato |
|--------|----------------------|-------------------|------------------------------|-------------------|-------|
| R-AUTH-01 | Login BSS con `project_id` | `02` E, `05` Step 4 | API staging | T-AUTH-01 | |
| R-INV-01 | Token invito scaduto | `10` §6 | API negativo | T-INV-01 | |
| R-WS-01 | Non-member → 403 risorse workspace | `07` §9, `09` | E2E | T-WS-01 | |

**Regola:** se manca “ID test” sulla riga §9b o la riga §9b non esiste, la story non soddisfa DoR §8 punti **4** e **6** (test nominati + matrice compilata).

### 9c) Guardrail sicurezza cross-funzione (minimi)

- **Token surface**: documentare esplicitamente se la UI trattiene refresh opaco, JWT Followup, o token BSS; vietato introdurre un terzo tipo senza ADR (`00`, `03`).
- **Inviti**: ordine `consumeInviteToken` vs policy password (`10`); finché non fixato, classificare come **known issue** con compensazione (es. monitoraggio abusi) in release notes.
- **Progetti**: ogni route che usa `getProjectContext` deve propagare `workspaceId` in FE e nei test contract (`12` §6.4); 400 per query mancante va coperto da test automatico o Newman.
- **Idempotenza**: POST invito, associate progetto-workspace, grant scope — definire comportamento su retry (409 vs no-op) e testarlo.
- **Segreti e config**: variabili `INVITE_*`, email, gateway URL — checklist deploy in `06` / runbook §2.

### 9d) Tipi di test obbligatori per area (minimo non negoziabile)

| Area | Unit | Contract / Newman (gateway) | API integrazione BE | E2E UI |
|------|------|------------------------------|----------------------|--------|
| Auth dual-mode (`AUTH_MODE`) | parser token, mapping errori | `/login` shape vs adapter FE | login+refresh per modalità | login happy path |
| Workspace membership | helper canAccess | — | GET `/workspaces` filtrato, 403 su altrui | invito visibilità |
| Inviti | hash token, TTL | path pubblici se esposti | scaduto / usato / duplicato | flusso email mock |
| Progetti + workspace | `ensureProjectInWorkspace` | path con query | 404 progetto non nel WS | crea+associa+lista |
| RBAC / JWT | `buildAccessPayload…` | — | route protette per ruolo | access_scope liste |

**Nota onesta (“copertura totale”)**: questa tabella definisce il **minimo** staff-engineer-friendly; non sostituisce test di carico, chaos né pen-test. La percentuale “99,9%” non è garantibile solo da documentazione: richiede suite eseguita in CI/CD + ambiente rappresentativo.

---

## 10) Collegamenti ai documenti esistenti

- Contesto e vincoli: `00-context-and-constraints.md`
- Blueprint PO workspace: `01a-workspaces-first-analysis-followup-vs-bss-legacy.md`
- Dettaglio tecnico workspace: `01-workspace-deep-dive.md`
- Gap API/auth: `02-poc-vs-legacy-gap-matrix.md`
- BE / dati / gateway / roadmap: `03`, `04`, `05`, `06`
- Utenti / RBAC / inviti (dettaglio POC + edge case): `08`, `09`, `10`
- Implementazione legacy-first / BSS (matrice lavoro, spike): `11-bss-legacy-bridge-api-and-data-matrix.md`
- Progetti nel workspace e permessi per progetto: `12-projects-workspace-users-and-permissions.md`

Tabelle test per dominio (da incrociare con §9b): `02` §G (gap), `08` §9.4 (identità), `09` §11 (JWT), `10` §9 (inviti), `12` §11 (progetti), `11` §8a (chiusura spike).

**Prossimo passo consigliato**: copiare le tabelle §1, §4, §5 nelle descrizioni Epic/Story Jira TECMA e allegare snippet OpenAPI generati da §3 in MR `aws-api-gateway`; includere anche una riga §9b per ogni story con ID test.

---

## 11) Appendice — esempi Jira TECMA (copy-paste)

Titoli con convenzione `[Area]` (adattare l’area al ramo backlog reale, es. `[Cross]`). Progetto **TECMA**; genitore/Epic Link coerenti con il Theme/Category usato dal team.

### Epic (esempio)

**Summary:** `[Cross] Followup 3.1 — Workspace: inviti e membership senza utenti orfani`

**Obiettivo:** eliminare ambiguità tra invito utente e membership workspace, con audit e rollback gestibili.

**Descrizione:** allineare flussi a `07` §2.1–§3; dipendenze Security su token invito e rate limit.

**Valore di business:** riduzione ticket operativi e rischio accessi errati.

**Piano di lavorazione:** Story 11.1 → 11.2 → QA gate §9.

**Limitazioni e dipendenze:** decisione G-AUTH-01; merge OpenAPI gateway.

**Monitoraggio e KPI:** §5.

**Punti aperti:** policy esatta su utente esistente + invito workspace.

**Prossimi step:** refinement con owner da registro §1.

---

### Story 11.1 (formato TECMA)

**Summary:** `[Cross] Workspace — API invito scoped + stati lifecycle`

**Descrizione:**

```markdown
## User Story:

### Who:
Admin workspace e nuovo collaboratore invitato.

### What:
Esporre REST per creare/listare/respingere inviti legati a un workspace con stati espliciti.

### Why:
Oggi l’invito è user-centric e non garantisce membership workspace, generando utenti orfani e richieste al supporto.

## Supporting Material:
- Runbook `07` §2.1, §3.1–3.3
- Gap G-WS-01, G-API-01

## Acceptance criteria:
1. POST invito con workspaceId valido restituisce `inviteId` e `expiresAt` in `data`.
2. GET lista inviti supporta paginazione standard TECMA.
3. Revoca impedisce uso successivo del token (test automatico o manuale documentato).
4. 409 su email con invito pending duplicato (policy prodotto documentata).
5. Audit evento con `workspaceId`, actor, `inviteId`.

## Technical Description:
- OpenAPI in MR `architecture/aws-api-gateway`; operationId camelCase; security ApiKeyAuth + BearerAuth; ErrorResponse.
- BE: persistenza token solo hash; TTL da config; rate limit allineato a `public.routes` pattern esistente.
```

---

### Story 11.2 (formato TECMA)

**Summary:** `[Cross] Workspace — Onboarding post-invito: membership atomica o saga`

**Descrizione:**

```markdown
## User Story:

### Who:
Nuovo utente dopo set-password da invito.

### What:
Completare l’ingresso nel workspace senza stati intermedi non gestiti (pending membership o transazione compensata).

### Why:
Evitare account attivi senza ruolo workspace e ridurre escalation Security.

## Supporting Material:
- Runbook `07` §2.1 passi 3–4
- Gap G-WS-01

## Acceptance criteria:
1. Dopo set-password riuscito, l’utente risulta membro del workspace atteso salvo errore esplicito mostrato in UI.
2. In caso di fallimento membership, l’utente non resta “attivo senza workspace” o è documentato lo stato di recovery (retry / supporto).
3. Test: invito → password → membership presente in GET `/workspaces/{id}/users`.
4. Test negativo: workspace inesistente → 404, nessuna membership parziale incoerente.

## Technical Description:
- Implementare saga o stato `pending_membership` su invito (ADR breve in repo).
- Feature flag per rollback a runbook POC documentato in `06`.
```

---

### BE-SubTask (esempio, figlio di Story 11.1)

**Summary:** `[Cross] BE — Persistenza tz_inviteTokens workspace-scoped`

**Microservizio / ambito:** `be-followup-v3` (o servizio successor).

**Descrizione:** estendere modello invito con `workspaceId`, hash token, TTL, stato.

**Dettaglio tecnico:** collection/index; migrazione dati inviti legacy se necessario; test integrazione.

**Criteri di accettazione:** coerenti con Story 11.1 AC 1, 3, 5.

**Materiali:** `07` §3.

**Dipendenze:** Security approva TTL e rate limit.
