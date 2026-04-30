# Spec — adattamento backend Followup 3.1 (legacy-first)

## Scopo

Definire come evolvere `be-followup-v3` verso un deployment **compatibile con legacy source of truth read/write** e con **TECMA-BSS** come interfaccia primaria verso il backend legacy, **senza** richiedere migrazioni dati legacy.

## Non-obiettivi (espliciti)

- Riscrivere l’intero dominio CRM del POC verso `/v2/...` BSS in un solo step.
- Unificare *de facto* public swagger e raw gateway senza un processo di governance (quello è in `05`).
- Introdurre dipendenze hard-coded verso cluster Mongo non controllati dal progetto (tutto via config).

## Principi architetturali

1. **Legacy-first read/write**
   - **Read legacy**: BSS (HTTP) e/o letture dirette dove approvato.
   - **Write legacy**: per i domini esistenti (clienti, appartamenti, richieste, utenti, progetti) tramite contratti/servizi legacy approvati.
   - **Write additive (`tz_*`)**: solo per capability nuove non coperte dal legacy (es. workspace layer, audit esteso, metadata applicativi).

2. **Anti-corruption layer (ACL)**
   - Un modulo dedicato traduce:
     - errori BSS → `HttpError` del POC
     - modelli legacy user/project/client → modelli interni Followup

3. **Feature flags operativi**
   - `AUTH_MODE=bss|followup|hybrid`
   - `CRM_READ_MODE=bss|mongo_ro|hybrid`
   - `CRM_WRITE_MODE=legacy_approved|hybrid_controlled`

   Default approvato: `legacy_approved`. `hybrid_controlled` è ammesso solo per capability nuove/additive e deve essere documentato.

## Stato attuale (baseline codice) — vincoli reali

### Auth: due implementazioni già presenti

- Login POC: `POST /v1/auth/login` (`public.routes.ts` → `loginWithCredentials`)
- Login BSS lato FE: `loginBss` (`bssAuthAdapter.ts`)

### Session/projects: endpoint POC necessari al flusso “senza project_id”

- `POST /v1/session/projects-by-email` (`session.routes.ts` → `getProjectAccessByEmail`)

### Workspace: dominio interamente `tz_*`

Vedi `01-workspace-deep-dive.md`.

### Gap noto da risolvere in implementazione (non solo documentazione)

- `access_scope` membership vs filtri liste: oggi persistito ma non propagato al viewer delle query (`listQueryViewer.ts` vs `entity-assignment-query.util.ts`).

## Target architecture (moduli consigliati)

> I nomi sono proposte; l’importante è l’ownership e il confine.

### 1) `legacyBss/` (HTTP client + mapper)

Responsabilità:

- chiamare `POST /login`, `POST /v1/auth/refresh-token`, `POST /v1/users/getUserByJWT` (percorsi effettivi come da environment gateway)
- gestire headers: `Authorization`, eventuali header gateway, timeouts, retry **limitati** su 429/503
- normalizzare response in DTO interni stabili

Non responsabilità:

- non conoscere Express routes
- non accedere a Mongo direttamente

### 2) `identity/` (single place)

Responsabilità:

- definire `InternalUser` (id stabile, email, ruoli legacy, flags admin)
- unificare lookup utente:
  - oggi `USER_COLLECTION_CANDIDATES` (login) vs `tz_users` hardcoded (`projectAccess.service.ts`) va convergente

**Decisione richiesta:**

- L'identità canonica resta legacy/BSS.
- `tz_users` può esistere solo come projection/cache governata o come estensione per capability non coperte, non come source of truth generale.

### 3) `tenancy/` (workspace)

Responsabilità:

- membership, workspace↔project, assignments: già presenti come services (`workspace-*.service.ts`, `entity-assignments.service.ts`)
- garantire che le write dei domini legacy passino dai percorsi legacy approvati, evitando bypass ad hoc non governati

### 4) `authn/` e `authz/` (separazione netta)

- `authn`: token issuance, refresh, SSO, session store (`tz_authSessions`)
- `authz`: `canAccess`, `permissionMiddleware`, RBAC workspace

## Strategie ammissibili per AUTH (scegliere 1 primaria + fallback opzionale)

### Strategia A — **BSS-first** (consigliata se l’obiettivo è massima aderenza al gateway)

Flusso:

1. FE ottiene `project_id` (picker progetti) — anche se popolato da endpoint additivo.
2. `POST /login` BSS → salva `accessToken`/`refreshToken` BSS.
3. Followup BE, quando deve fare operazioni legacy, usa **token BSS** verso BSS.

Followup JWT (locale) diventa opzionale o solo per “moduli nativi”.

**Pro**

- allineamento naturale col mondo `/v2/...`
- meno duplicazione semantica auth

**Contro**

- UX deve risolvere `project_id` prima del login (o login multi-step)

### Strategia B — **Followup-first** (consigliata se l’obiettivo è preservare UX attuale)

Flusso:

1. `POST /v1/auth/login` (senza project) + MFA + refresh opaco (`tz_authSessions`)
2. Per letture legacy, un componente server-side usa BSS con **credenziali di servizio** *solo se accettato* (di solito **no** per compliance)

**Pro**

- mantiene UX e permessi granulari del POC

**Contro**

- richiede un modo “pulito” per leggere legacy senza impersonation illegittima
- complica il modello threat (non usare password utente lato server per chiamare BSS)

### Strategia C — **Hybrid esplicito** (spesso la più realistica)

- Login utente: BSS quando `VITE_USE_BSS_AUTH=true`
- Moduli nativi: JWT Followup
- Introdurre un **bridge** documentato (es. claim o header interno) solo tra servizi trusted (preferibilmente **no** se evitabile)

**Decisione da prendere con Security**: definire se esiste un pattern approvato (m2m token, scoped service user, ecc.).

## Strategie ammissibili per CRM read

### CRM read via BSS (default “contratto”)

Il BE Followup espone `/v1/clients/query` ecc., e internamente:

- traduce query → chiamate `/v2/...` BSS (paginazione/filtri)

**Acceptance criteria**

- per ogni query FE esistente, definire mapping campi (anche se MVP inizia con subset)

### CRM read diretto (opzionale)

Solo dove:

- BSS non espone filtri necessari
- costi/latency lo richiedono

**Risk**

- duplicazione fonte di verità: serve rigorosa disciplina “write sempre legacy/BSS” per i domini esistenti.

## Strategie ammissibili per CRM write

Default atteso:

- write su legacy per i domini legacy esistenti;
- evitare CRM parallelo su `tz_clients` / `tz_apartments` salvo eccezioni deliberate e governate.

Se un dominio nasce solo nel layer Followup e non esiste nel legacy, può usare `tz_*` come storage additivo.

### Nota fuori scope: greenfield completo

Il POC dimostra un modello `tz_*` più pulito, ma il greenfield completo non è approvato per Followup 3.1. Non va usato come target implementativo salvo decisione CTO separata.

## Correzioni funzionali richieste dal gap analysis

### 1) `access_scope` deve governare liste

Requisito:

- se membership `access_scope="assigned"` allora le liste devono applicare filtri assignment **anche** se l’utente non è admin
- se `access_scope="all"` allora policy “assignment solo se presente riga” resta valida oppure va raffinata (decisione prodotto)

Implementazione minima suggerita:

- estendere `EntityAssignmentListViewer` con `accessScope`
- popolare da `tz_user_workspaces` per workspace corrente (cache per request)

### 2) Convergenza lookup utente

Requisito:

- `getProjectAccessByEmail` non deve hardcodare `tz_users` se il login usa altre collection candidate, oppure
- rendere configurabile e allineare i dati

## Osservabilità, audit, sicurezza

### Audit

Il POC già registra eventi auth (`authAudit`) e azioni workspace (`audit-log.service.ts` via `workspaces.routes.ts`).

Requisito:

- audit events devono includere `tenant/workspaceId` quando noto

### Rate limit

Il POC ha rate limit su login/refresh (`public.routes.ts`).

Requisito:

- in hybrid BSS, applicare rate limit anche ai path proxy verso gateway (anche a livello infra)

## Dipendenze cross-team

- **Security**: approvazione strategia auth (A/B/C) e uso token.
- **Platform**: stageVariables URL verso BE Followup per merge OpenAPI (`05`).
- **Legacy backend**: conferma contratti `/login` reali (public vs raw).

## Criteri di accettazione (backend)

- Con `AUTH_MODE=bss`, un utente può completare login e ottenere token BSS senza chiamare `POST /v1/auth/login`.
- Con `AUTH_MODE=followup`, un utente può completare login senza `project_id` e ottenere JWT + refresh opaco.
- In entrambe le modalità, `requireCanAccessWorkspace` continua a funzionare su workspace `tz_*`.
- Le write dei domini legacy passano dai contratti legacy/BSS approvati e sono tracciate.

## Rischi

- **Drift contratti** BSS (public swagger vs runtime) → mitigazione: contract tests + source of truth raw.
- **Doppio token** (BSS + Followup) → mitigazione: strategia unica + documentazione operativa.
- **Permessi** (`PERMISSIONS.*` vs ruoli legacy) → mitigazione: tabella di mapping versionata + test.

## Testing e osservabilità (minimi da non rimuovere in porting)

- **Log strutturati**: `traceId`/`tId` coerente con `ErrorResponse` gateway dove possibile; mai loggare password, token pieno o secret inviti.
- **Metriche**: contatori errori per `AUTH_MODE`, latenza adapter verso BSS, rate di 401/403 su route workspace (dashboard minima prima della GA adattiva in `06`).
- **Test automatici BE**: per ogni nuovo middleware (`requireCanAccessWorkspace`, `requireCanAccessProject`, varianti JWT) almeno due test — permesso concesso e negato — con fixture utente/membership esplicite.
- **Allineamento QA**: la colonna “API integrazione BE” in `07` §9d deve citare i file di test o job CI che coprono la modifica; se manca, la MR non passa il gate DoR §8 punti **4**, **6** e **7** (test tracciati, riga §9b, tipi test §9d dichiarati).
