# Followup 3.0 — Refactoring agile (FE + BE) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use **subagent-driven-development** (recommended) or **executing-plans** to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eseguire il refactoring incrementale descritto in `docs/plans/2026-03-25-followup-refactoring-agile-design.md`, con MR piccoli, comportamento invariato e pipeline verde.

**Architecture:** Estrazione domini nel client FE (`api/domains`), facade `followupApi` come composizione; spezzatura file route BE senza cambiare URL; DRY mirato in `http.ts` e adapter solo con test; pagine grandi divise in hook/sezioni.

**Tech Stack:** React + Vite + Vitest (`fe-followup-v3`); Express + Vitest (`be-followup-v3`); TypeScript; ESLint.

**Prerequisiti:** Leggere il design linkato sopra e `fe-followup-v3/ARCHITECTURE.md`. Preferire **worktree** git dedicato prima del primo task.

---

## File map (riferimento rapido)

| Area | File / cartella chiave |
|------|-------------------------|
| API FE facade | `fe-followup-v3/src/api/followupApi.ts` |
| API FE domini esistenti | `fe-followup-v3/src/api/domains/clientsApi.ts`, `apartmentsApi.ts`, `requestsApi.ts` |
| HTTP FE | `fe-followup-v3/src/api/http.ts`, `http.test.ts` |
| Integrazioni UI | `fe-followup-v3/src/core/integrations/ConnettoriTab.tsx` |
| Pagine oversize | `fe-followup-v3/src/core/projects/ProjectDetailPage.tsx`, `clients/ClientDetailPage.tsx`, `workspaces/WorkspacesPage.tsx`, … |
| Route BE | `be-followup-v3/src/routes/v1/workspaces.routes.ts`, `connectors.routes.ts`, `be-followup-v3/src/routes/v1.ts` |
| Future (da verificare) | `be-followup-v3/src/routes/v1/future.routes.ts`, `be-followup-v3/src/core/future/future.service.ts` |
| Adapter firma | `be-followup-v3/src/core/contracts/docusign.adapter.ts`, `yousign.adapter.ts` |

---

### Task 1: BE — Verificare e ripulire `future.routes`

**Files:**
- Read: `be-followup-v3/src/routes/v1.ts` (o mount router v1)
- Read: `be-followup-v3/src/routes/v1/future.routes.ts`
- Read: `be-followup-v3/src/core/future/future.service.ts`
- Modify: uno tra — rimuovere import/mount morti, eliminare file duplicativo, o documentare in testa al file perché esiste se serve solo come riferimento

- [ ] **Step 1:** Cercare riferimenti a `future.routes` nel repo BE (`rg future.routes be-followup-v3`).

- [ ] **Step 2:** Confermare che nessun mount attivo lo espone; se è dead code, rimuovere file e import; altrimenti allineare naming/export con un commento `NOTE:` e un issue link (se il team usa issue tracker).

- [ ] **Step 3:** Eseguire test e lint BE.

Run (da `be-followup-v3/`):

```bash
npm run test
npm run test:lint
```

Expected: exit code 0.

- [ ] **Step 4:** Commit.

```bash
git add src/routes
git commit -m "chore(routes): clarify or remove unused future routes module"
```

---

### Task 2: FE — Estrarre il primo nuovo dominio API (es. `projects`)

**Files:**
- Create: `fe-followup-v3/src/api/domains/projectsApi.ts`
- Create (se utile): `fe-followup-v3/src/api/domains/projectsApi.test.ts`
- Modify: `fe-followup-v3/src/api/followupApi.ts` (import e composizione `followupApi.projects`)
- Modify: consumer che oggi chiamano metodi flat su `followupApi` per progetti (solo ciò che viene spostato in questo MR)

- [ ] **Step 1:** In `followupApi.ts`, identificare un cluster coeso di metodi legati a **progetti** (naming path `/project` o simile). Elencare i metodi da spostare.

- [ ] **Step 2:** Creare `projectsApi.ts` copiando lo stile di `clientsApi.ts` / `requestsApi.ts` (stessi helper `getJson`, `postJson`, … da `http.ts`).

- [ ] **Step 3:** Esportare oggetto `projectsApi` e collegarlo in `followupApi` come `projects: projectsApi` (o nome allineato al dominio).

- [ ] **Step 4:** Migrare **solo** i file toccati in questo MR da `followupApi.getX` a `followupApi.projects.getX` (o equivalente). Evitare di migrare tutto il repo in un colpo solo.

- [ ] **Step 5:** Eseguire FE test, typecheck, lint.

Run (da `fe-followup-v3/`):

```bash
npm run test:run
npm run typecheck
npm run test:lint
```

Expected: exit code 0.

- [ ] **Step 6:** Commit.

```bash
git add src/api
git commit -m "refactor(api): extract projects domain client"
```

---

### Task 3: FE — Rimuovere shim duplicati per `requests` (e analoghi)

**Files:**
- Modify: `fe-followup-v3/src/api/followupApi.ts` (rimuovere export flat duplicati dopo migrazione)
- Modify: consumer: `rg "queryRequests|getRequestById|createRequest"` in `fe-followup-v3/src` e aggiornare a `followupApi.requests.*`

- [ ] **Step 1:** Trovare tutti gli usi dei metodi flat duplicati di requests (grep come sopra).

- [ ] **Step 2:** Sostituire con `followupApi.requests.<metodo>` (stesso comportamento, stessi tipi).

- [ ] **Step 3:** Rimuovere le funzioni shim da `followupApi.ts` se nessun import resta.

- [ ] **Step 4:** `npm run test:run && npm run typecheck && npm run test:lint` in `fe-followup-v3/`.

- [ ] **Step 5:** Commit.

```bash
git commit -m "refactor(api): consolidate requests client on followupApi.requests"
```

---

### Task 4: FE — DRY in `http.ts` (token, refresh, errori)

**Files:**
- Modify: `fe-followup-v3/src/api/http.ts`
- Modify: `fe-followup-v3/src/api/http.test.ts` (aggiungere/adattare test se coprono branch condivisi)

- [ ] **Step 1:** Leggere `requestJson` e `postFormData` e identificare blocco duplicato (headers, 401/refresh, parse body errore).

- [ ] **Step 2:** Estrarre funzione interna `async function authorizedFetch(...)` o simile **senza** cambiare firme pubbliche esportate.

- [ ] **Step 3:** Garantire che i messaggi di errore di rete restino coerenti tra i due percorsi.

- [ ] **Step 4:** `npm run test:run` in `fe-followup-v3/` (focus `http.test.ts` se presente).

- [ ] **Step 5:** Commit.

```bash
git commit -m "refactor(api): dedupe auth and error handling in http client"
```

---

### Task 5: BE — Spezzare `workspaces.routes.ts` (primo split)

**Files:**
- Modify: `be-followup-v3/src/routes/v1/workspaces.routes.ts` (ridurre dimensione)
- Create: es. `be-followup-v3/src/routes/v1/workspaces-users.routes.ts` o `workspaces/entitlements.routes.ts` (nome scelto in base ai gruppi di endpoint nel file)
- Modify: `be-followup-v3/src/routes/v1.ts` (mount dei sotto-router se necessario)

- [ ] **Step 1:** Suddividere gli endpoint in 2 gruppi logici (es. CRUD workspace vs utenti/entitlements) leggendo il file corrente.

- [ ] **Step 2:** Spostare un gruppo in un nuovo file che esporta `Router` Express; montare con lo **stesso path prefix** di prima così gli URL non cambiano.

- [ ] **Step 3:** `npm run test` e `npm run test:integration` (se usata nel team per route).

Run:

```bash
npm run test
npm run test:integration
```

Expected: exit code 0.

- [ ] **Step 4:** Commit.

```bash
git commit -m "refactor(routes): split workspaces routes for readability"
```

---

### Task 6: BE — Deduplicare adapter DocuSign / Yousign (solo se i test coprono)

**Files:**
- Modify: `be-followup-v3/src/core/contracts/docusign.adapter.ts`
- Modify: `be-followup-v3/src/core/contracts/yousign.adapter.ts`
- Create (opzionale): `be-followup-v3/src/core/contracts/signature-http.util.ts` (helper `postSignatureRequest` generico)

- [ ] **Step 1:** Confrontare i due adapter e estrarre solo ciò che è identico (fetch POST, gestione `!res.ok`, struttura mock).

- [ ] **Step 2:** Mantenere differenze specifiche del provider in ciascun file.

- [ ] **Step 3:** Eseguire test esistenti su firma/webhook; aggiungere un test unit minimo sull’helper se non c’è copertura.

- [ ] **Step 4:** Commit.

```bash
git commit -m "refactor(contracts): share signature adapter HTTP helpers"
```

---

### Task 7: FE — Split `ConnettoriTab.tsx` (prima sezione)

**Files:**
- Modify: `fe-followup-v3/src/core/integrations/ConnettoriTab.tsx`
- Create: es. `fe-followup-v3/src/core/integrations/connectors/MessagingConnectorsSection.tsx` (nome reale in base alla prima sezione estratta)

- [ ] **Step 1:** Scegliere **una** famiglia di connettori (es. messaging) e spostare JSX + stato locale in un componente figlio con props esplicite.

- [ ] **Step 2:** `ConnettoriTab` resta orchestratore: passa dati e callback.

- [ ] **Step 3:** `npm run test:run && npm run typecheck && npm run test:lint` e, se esiste test su integrazioni, includerlo.

- [ ] **Step 4:** Commit.

```bash
git commit -m "refactor(integrations): extract first section from ConnettoriTab"
```

Ripetere **Task 7** per altre sezioni in MR separati.

---

### Task 8: FE — Decomposizione `ProjectDetailPage.tsx` (hook o tab)

**Files:**
- Modify: `fe-followup-v3/src/core/projects/ProjectDetailPage.tsx`
- Create: es. `fe-followup-v3/src/core/projects/hooks/useProjectDetailForm.ts` o `ProjectLegalSection.tsx`

- [ ] **Step 1:** Estrarre **una** macro-area (es. sezione legali/PDF o marketing) in file dedicato.

- [ ] **Step 2:** Ridurre `useState` nel file principale spostando stato nel hook o nel figlio.

- [ ] **Step 3:** `npm run test:run && npm run typecheck`; eseguire `npm run check:detail-architecture` se lo script è parte della CI locale.

- [ ] **Step 4:** Commit.

```bash
git commit -m "refactor(projects): extract section from ProjectDetailPage"
```

---

## Ordine consigliato e parallelismo

- **Parallelo ammesso:** Task 1 (BE) + Task 2 (FE) su branch diversi o worktree diversi.
- **Sequenza stretta:** Task 3 dopo Task 2 se Task 2 tocca ancora `followupApi` nello stesso blocco; Task 4 indipendente dopo stabilizzazione import.
- **BE Task 5** indipendente da FE salvo merge conflicts su `v1.ts`.

---

## Definition of done (ogni task)

- Nessun cambiamento di contratto HTTP non documentato.
- Comandi di verifica del task eseguiti con successo.
- Commit atomico con messaggio `refactor:` / `chore:` coerente.

---

## Post-piano (opzionale)

- Dispatch **plan-document-reviewer** sul presente file e sul design; iterare se necessario.
- Dopo completamento: **finishing-a-development-branch** per merge/PR.
