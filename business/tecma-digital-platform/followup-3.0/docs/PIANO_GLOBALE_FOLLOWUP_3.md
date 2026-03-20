# Followup 3.0 — piano globale (unico)

**Ultimo aggiornamento:** 2026-03-20 (Fase 0.1 DoD baseline — wizard utenti, mount asset/documents, audit membership)  
**Uso:** questo è l’**unico documento di piano** per Followup 3.0. Aggiornare solo questo file per priorità, fasi e checklist.  
**Correlati (non sono “piani”):** visione e wave in [FOLLOWUP_3_MASTER.md](./FOLLOWUP_3_MASTER.md); deploy in [RENDER_DEPLOY.md](./RENDER_DEPLOY.md); runbook e design system negli altri file in `docs/`.

---

## 1. Scopo e north star

- CRM verticale real estate (rent + sell), multiprogetto, **semplice da usare ogni giorno**.
- Utenti **non tecnici**: flussi lineari, linguaggio chiaro, progressive disclosure.
- **API** riusabili anche fuori dal CRM (listing, preventivi, connettori) dove ha senso.
- **Legacy Mongo:** solo lettura o estensioni additive con prefisso `tz_*` (nessuna modifica distruttiva allo schema legacy).

---

## 2. Checklist operativa (stato da aggiornare qui)

| ID | Tema | Stato |
|----|------|--------|
| `close-phase0` | Workspace users, `tz_workspace_user_projects`, entity assignments, Wave 7 AI aggregata, auth API connettori | **Chiuso baseline repo (2026-03-20):** §3.1–§3.2 implementati; §3.3 FE accordion + BE aggregato presenti; §3.4 `POST /v1/platform/clients/lite/query` + scope `platform.clients.read`; §3.5 route matching registrate. Review integrazione continua in CI. |
| `user-access-granularity` | Creazione utenza + RBAC granulare (modulo / azione / progetto) | **Chiuso baseline 0.1 (2026-03-20):** sweep JWT su route sensibili; mount **assets** + **client-documents**; session/realtime/contracts hardening; wizard **4 passi** Utenti + `GET /rbac/roles/:roleKey/effective-permissions` + preset override; matrice da **permission-catalog**; audit membership workspace + **user_project** add/remove; router `future`/`workflow` documentati come non montati. Estensioni future: altre mutazioni in audit, OpenAPI completo RBAC. [FASE01](./deliverables/FASE01_USER_ACCESS_RBAC.md) |
| `commercial-entitlements` | Entitlement commerciale vs RBAC; solo Tecma attiva connettori/API | Roadmap: [deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md](./deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md) |
| `connectors-showcase-ux` | Vetrina connettori/API per utenti non Tecma | Incluso in FASE02 (sezione UX vetrina) |
| `tecma-activation-audit` | Console Tecma + audit attivazioni + fatturazione manuale | Incluso in FASE02 (milestone audit + console) |
| `csv-mapping` | CSV legacy → mapping cliente / appartamento / quote → `tz_*` + API/UI | Template: [deliverables/FASE1_CSV_MAPPING.md](./deliverables/FASE1_CSV_MAPPING.md) — compilare quando disponibili i CSV |
| `s3-verify` | `ASSETS_S3_BUCKET` + AWS + presigned upload/download | Checklist: [deliverables/FASE3_S3_VERIFICATION.md](./deliverables/FASE3_S3_VERIFICATION.md) |
| `digital-quote` | Stato trattativa → quote, PDF, magic link, bucket | Roadmap: [deliverables/FASE2_DIGITAL_QUOTE.md](./deliverables/FASE2_DIGITAL_QUOTE.md) |
| `reports-dashboards` | Report, dashboard condivisibili, AI (pattern API key workspace) | Roadmap: [deliverables/FASE4_REPORTS_DASHBOARDS.md](./deliverables/FASE4_REPORTS_DASHBOARDS.md) |
| `calendar-sync` | Eventi unificati timeline/calendario; Gmail/Outlook reali | Roadmap: [deliverables/FASE5_CALENDAR_SYNC.md](./deliverables/FASE5_CALENDAR_SYNC.md) |
| `connectors-ux` | Twilio dedicato; dummy real-estate; Mailchimp/AC (+ MCP opzionale) | Roadmap: [deliverables/FASE6_CONNECTORS_UX.md](./deliverables/FASE6_CONNECTORS_UX.md) |
| `inbox-contract` | Contratto notifiche, empty state, preferenze | Contratto: [deliverables/FASE7_INBOX_CONTRACT.md](./deliverables/FASE7_INBOX_CONTRACT.md) |
| `visual-parity` | Resa visiva vs `tecma-fe-apps/fe-tecma-itd` | Checklist: [deliverables/FASE8_VISUAL_PARITY.md](./deliverables/FASE8_VISUAL_PARITY.md) |
| `ux-mobile` | UX mobile: checklist per pagina, implementazione incrementale | |
| `refactor-api-layer` | Refactor FE API layer / pagine hub (a fasi, PR separate) | |
| `matching-be` | Opzionale: `GET /v1/matching/.../candidates` | |
| `dialog-drawer` | Opzionale: residui Dialog → Drawer | |
| `ux-liste-card-toggle` | Opzionale: card/toggle liste Clienti e Appartamenti | |

---

## 3. Fase 0 — Fondamenta in corso (non saltare)

### 3.1 Stream workspace e segregazione

**Contesto DB:** per gestione utenti/workspace scrivere su **test-zanetti** come da modello consolidato.

- **`user.workspaces[]`** sul documento utente (test-zanetti): `[{ workspaceId, role }, …]` — nessuna collection `tz_user_workspaces` dedicata. Indice su `workspaces.workspaceId`.
- **Route BE:** `GET/POST/PATCH/DELETE /workspaces/:id/users`; `GET/POST/DELETE .../users/:userId/projects`.
- **`tz_workspace_user_projects`:** se nessun record per `(workspaceId, userId)` → utente vede tutti i progetti del workspace; altrimenti solo i `projectId` elencati.
- **`getProjectAccessByEmail`:** `workspaceId` opzionale nel body di `POST /session/projects-by-email`; intersezione con `tz_workspace_projects` (se la lista per quel workspace è **vuota**, nessun filtro workspace — allineato al legacy demo/dev); per non-admin, se esistono righe in `tz_workspace_user_projects` si applica il sottoinsieme. **FE:** `ProjectAccessPage` / `getProjectsByEmail` passano il workspace Mongo (non legacy `dev-1`/`demo`/`prod`). **WorkspacesPage** continua a chiamare senza `workspaceId` per l’elenco progetti dell’admin da associare al workspace.
- **FE:** drawer “Aggiungi utente” con selezione progetti; dopo `addWorkspaceUser` chiamare `addWorkspaceUserProject` per ciascun progetto scelto.

**Implementato (2026-03-20):** `getProjectAccessByEmail` + test; `followupApi.getProjectsByEmail`; `ProjectAccessPage` ricarica i progetti quando cambia il workspace (Mongo).

### 3.2 Entity assignments

- Collection **`tz_entity_assignments`:** `workspaceId`, `entityType` (client | apartment), `entityId`, `userId`, `createdAt`.
- Route: assign / unassign / list.
- Query clienti/appartamenti: per non-admin, filtrare **nessuna assegnazione OR assegnato al current user** (admin vede tutto).

**Implementato (2026-03-20):** `POST /v1/clients/query`, `POST /v1/apartments/query`, `GET /v1/clients/:id`, `GET /v1/apartments/:id` applicano il filtro per viewer JWT non admin e non Tecma admin; tool agente AI (`search_*`, report) usano gli stessi criteri tramite `actorIsAdmin` / `actorIsTecmaAdmin`. Chiamate senza viewer (platform API key, public listings, servizi interni) restano senza filtro.

### 3.3 Wave 7 — Suggerimenti cockpit aggregati

**Implementato (baseline repo):** BE orchestrator con `aggregatedKind` / `aggregatedItems`; FE `PrioritySuggestionsList` con toggle dettaglio aggregato (`priority-aggregated-toggle`), cap `MAX_AGGREGATED_DETAIL_VISIBLE`, test Vitest dedicati.

- Obiettivo: ridurre card duplicate aggregando per `aggregatedKind` (max ~8 gruppi), con `aggregatedItems`, accordion in UI, sostituzione pending stesso-kind al refresh.
- Kind stabili esempio: `stale_proposal_7d`, `inactive_client_20d`, `available_unit`, `no_critical_signal`.
- BE: estendere tipi e Mongo `tz_ai_suggestions`; `buildRuleBasedRows` aggregato; `deleteMany` pending per stessi kind prima di insert; LLM merge 1:1 con gruppi.
- FE: `PrioritySuggestionsList` con accordion e cap UI.
- Test: Vitest orchestrator + FE ove applicabile.

### 3.4 API pubbliche / connettori (auth esterna)

**Implementato (2026-03-20):** `POST /v1/platform/clients/lite/query` (scope `platform.clients.read`, stesso servizio di `POST /v1/clients/lite/query` JWT); default scope esteso in `platformApiKeyMiddleware`; OpenAPI aggiornato; test `platform.routes.test.ts`. Listing già su `POST /v1/platform/listings/query`. OAuth esterno resta roadmap prodotto.

- OpenAPI già in `be-followup-v3/openapi/openapi.v1.yaml`, `GET /v1/openapi.json`.
- Completare **autenticazione dedicata** per chiamate esterne: API key workspace (es. `PLATFORM_API_KEYS` in env) e/o OAuth — allineare prodotti, doc e enforcement su `POST /apartments/query`, `POST /clients/lite/query`, ecc.

### 3.5 Matching (se richiesto)

**Presente in repo:** `GET /v1/matching/apartments/:id/candidates`, `GET /v1/matching/clients/:id/candidates` (`matching.routes.ts` + `matching.service`).

- Endpoint: `GET /v1/matching/apartments/:id/candidates`, `GET /v1/matching/clients/:id/candidates` (FE può essere già pronto).

---

## 4. Fase 0.1 — Utenze e accessi granulari

**Implementato (2026-03-20, slice 1):** in `be-followup-v3` estesi `PERMISSIONS` (clients, apartments, requests, calendar, reports, integrations, settings + azioni read/create/update/delete/export/assign/approve e `users.manageUsers`); `buildAccessPayloadFromUserDoc` unisce `permissions_override` ai permessi derivati dai ruoli workspace (prima venivano ignorati).

**Slice 2 (stesso giorno):** `buildPermissionCatalog()` + `GET /v1/rbac/permission-catalog` (protetto da `users.read`); `GET /v1/workspace-roles` registrato su `v1Router`; client `getPermissionCatalog` in FE.

**Slice 3:** lista `GET /users` espone `permissions_override`; UI Utenti (dettaglio + wizard) con `PermissionOverrideMatrix` e `PATCH /users/:id`; validazione override anche su `users-admin` PATCH.

**Slice 4:** `requirePermission` + scope workspace/progetto su clients, requests, calendar, apartments; `BUILTIN_ROLE_PERMISSIONS` collaborator/viewer allargati; `getPermissionsForRole` unisce sempre il piano minimo builtin ai permessi da `tz_roleDefinitions`; `yarn migrate:role-definitions:reconcile` per allineare il DB.

**Slice 5+ (2026-03):**

- BE: `requirePermission` anche su communications, connectors, automation-rules, intelligence; protezione route webhook-configs.
- FE: gate per sezione nelle pagine hub + `PermissionGated` sui percorsi dettaglio cliente e appartamento; catalogo `SECTION_REQUIRED_PERMISSION` esteso.
- Integrazioni: CTA disabilitate / sola lettura quando l’utente non ha il permesso richiesto.
- Operativo: `yarn migrate:role-definitions:reconcile` per allineare definizioni ruoli in DB dopo le estensioni (nessun deploy produzione documentato qui).

**Slice 6 (2026-03-20, batch parallelo):**

- BE: `requirePermission` su `projects.routes` (config progetto: `settings.read` / `settings.update` dove applicabile), `notifications.routes` (`requests.read` / `requests.update`), `matching.routes` (`clients.read` / `apartments.read`).
- FE: CTA principali liste **Clienti** e **Trattative** (toolbar, drawer, azioni tabella) disabilitate in base a `clients.*` / `requests.*` tramite `useWorkspace().hasPermission`.

**Slice 7 (2026-03-20):**

- BE: `requirePermission` / `requireAnyPermission` su `assets.routes`, `hc.routes`, `workspaces.routes` (matrice prezzi/disponibilità, lettura `ai-config`, assegnazioni entità con almeno un permesso CRM read), `discovery-workflow.routes` (`requests.read` su config e liste workflow). `client-documents` con `clients.read` / `clients.update`. Builtin **collaborator**: `settings.read`, `settings.update`, `reports.export` (allineato a progetti + export report).
- FE: gate CTA lista **Appartamenti** (create/update/export), sheet dettaglio; **Calendario** (`calendar.create` / `update` / `delete` su Nuovo evento e drawer); **Report** (export CSV con `reports.export`). Rimossi fetch di debug verso host locale in `CalendarPage`.
- OpenAPI: path documentati per `/workspaces/{workspaceId}/webhook-configs` e `/webhook-configs/{id}`.

- Wizard creazione utente: anagrafica → workspace → progetti → ruolo → permessi avanzati.
- Template ruoli (admin, manager, agent) con override puntuali.
- **Permission matrix:** modulo × azione (read, create, update, delete, export, assign, approve, manageUsers) per clients, apartments, requests, calendar, reports, integrations, settings.
- Scope progetto + **`tz_entity_assignments`** dove serve.
- Persistenza additiva su utente (test-zanetti), compatibile con `user.workspaces[]` e `tz_workspace_user_projects`.
- Enforcement: middleware BE + nascondere CTA/sezioni in FE; default deny; audit su azioni critiche.

---

## 5. Fase 0.2 — Entitlement commerciale e integrazioni

**Problema:** connettori e API sono tecnici e spesso a pagamento; non c’è billing self-service in app — attivazione governata da Tecma, fatturazione esterna.

**Principio:** `canUseFeature = isEntitled(workspace, feature) AND hasPermission(user, action)`.

**Tecma Admin (fonte di verità codice):** `system_role === "tecma_admin"` **oppure** `isTecmaAdmin === true` (allineare FE/BE, riusare `requireTecmaAdmin` dove serve).

**Modello:** `tz_workspace_entitlements` (o blocco su workspace) per capability: `twilio`, `mailchimp`, `activecampaign`, `publicApi`, … con `status`: `inactive | pending_approval | active | suspended`, `billingMode: manual_invoice`, note e audit.

**UX non Tecma:** vetrina (benefici, casi d’uso, CTA “Contatta Tecma / Richiedi attivazione”); niente attivazione autonoma; tab API senza operazioni tecniche (o nascoste).

**UX Tecma Admin:** console attivazione/disattivazione, note commerciali, audit.

**Milestone:** (1) modello DB (2) policy engine (3) endpoint governance (4) vetrina FE (5) console Tecma (6) audit (7) rollout graduale (prima twilio + publicApi, poi email marketing).

**DoD:** non-Tecma non attiva né vede strumenti API operativi; Tecma sì, con audit; ogni route sensibile verifica RBAC + entitlement.

---

## 6. Fase 1 — Dati legacy (**data_first**)

**Input:** CSV/export — analisi obbligatoria prima di schema/UI.

1. **Cliente:** mapping colonne → modello attuale + `tz_*` / sezioni “Mostra altro”.
2. **Appartamento:** stesso approccio.
3. **Quote (standard/custom legacy read-only):** campi per preventivo digitale e trattative; snapshot persistito (es. `tz_quotes`) vs lettura legacy.

**Deliverable:** documento di mapping + ordine implementazione API/FE.

---

## 7. Fase 2 — Preventivo digitale + magic link

- Trigger: transizione stato trattativa → crea record preventivo.
- Output: pagina pubblica (token firmato, scadenza, audit) + **PDF** → upload storage + URL in DB.
- Dipende da Fase 1 (modello quote) e Fase 3 (bucket).

---

## 8. Fase 3 — Bucket / storage

- Variabili: `ASSETS_S3_BUCKET` o fallback `EMAIL_FLOW_S3_BUCKET`; `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.
- Codice: `be-followup-v3/src/core/assets/assets-s3.service.ts`; email asset: `EMAIL_FLOW_S3_BUCKET`, `EMAIL_FLOW_S3_PUBLIC_BASE_URL` opzionale.
- Verificare con [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) e policy IAM (`PutObject`, `GetObject`, `DeleteObject`).

---

## 9. Fase 4 — Report, dashboard condivisibili, AI

- Definizioni report persistite + esecuzione aggregata.
- Dashboard condivisibili: pattern magic link read-only (come preventivo).
- AI integrata: stesso modello “API key workspace” / opt-in; niente LLM senza configurazione cliente.

---

## 10. Fase 5 — Calendario (parity legacy + sync)

- **Una sorgente eventi** con `clientId` / `apartmentId` / `requestId`; creazione da calendario o timeline → stesso documento.
- **Gmail/Outlook:** OAuth reale, token refresh, sync incrementale (sostituire mock).

---

## 11. Fase 6 — Connettori e comunicazioni

- **Twilio:** card dedicata; tab “Comunicazioni” = automazioni Twilio, non generica.
- **Catalogo dummy real estate:** Meta Lead Ads, Google Ads/LSA, portali, Zapier/Make (affine webhook), DocuSign, HubSpot, Mailchimp, ActiveCampaign.
- **Connettori “veri”:** dopo entitlement + primo connettore stabile; MCP Cursor opzionale per debug API.

---

## 12. Fase 7 — Inbox

- Notifiche: `request_action_due`, `calendar_reminder`, `assignment`, `mention`, `other`; automazioni → `tz_notifications`.
- Migliorare: contratto “cosa genera notifica”, empty state, preferenze (mute), link sempre al contesto.

---

## 13. Fase 8 — Resa visiva

- Allineamento incrementale a `tecma-fe-apps/fe-tecma-itd` (immagini, gerarchia, micro-copy) usando componenti e token esistenti.

---

## 14. Qualità, test, CI (linee guida)

- Obiettivo: coverage ed E2E su flussi critici (login → cockpit → clienti → calendario → trattative → appartamenti); gate CI come da strategia qualità in repo.
- Refactor API layer / pagine grandi: **a fasi**, PR dedicate senza mescolare feature.

### 14.1 API / aws-api-gateway (evoluzione)

Obiettivo architetturale: esporre le API Followup tramite **TECMA-BSS** (aws-api-gateway), merge OpenAPI, test e allineamento FE. Riferimento tecnico aggiornato: [openapi-tecma-bss-additions.yaml](./openapi-tecma-bss-additions.yaml), [AUTH_AND_TECMA_BSS_API_REPORT.md](./AUTH_AND_TECMA_BSS_API_REPORT.md). Eventuali note storiche di progetto erano negli archivi rimossi e restano recuperabili da git.

---

## 15. Millennium (UX) — sintesi già in prodotto

| Area | Contenuto |
|------|-----------|
| W1 | Command Palette (Cmd/Ctrl+K), ricerca entità, sidebar persisted |
| W2 | Inbox header + notifiche |
| W3 | Customer 360 (scheda cliente, tab, timeline) |
| W4 | Integrazioni: tab Connettori, Regole, Webhook, API — completare auth esterna e entitlement (Fase 0.2) |

---

## 16. Note su documenti eliminati

I precedenti file multipli (`PLAN_UNIFICATO_*`, `docs/plans/2026-*`, piani in `docs/archive/*`, millennium in FE, roadmap/design in `archive/plans-2025-2026`) sono stati **accorpati e rimossi** su richiesta: la verità operativa resta **solo** questo file. Contenuti di runbook, sicurezza e design system restano negli altri `.md` in `docs/` dove non sono duplicati di questo piano.

---

## 17. Implementazione con subagent (suggerimento)

- **Un subagent = un obiettivo** con confine file/chiaro (es. solo `be-followup-v3/src/core/workspaces` o solo `IntegrationsPage`).
- **Parallelo** solo senza sovrapposizione sugli stessi moduli.
- Ordine suggerito: chiudere Fase 0 (workspace + assignments + AI + API keys) → Fase 0.1/0.2 (RBAC + entitlement) → Fase 1 dopo CSV → Fase 3 storage → Fase 2 preventivo → report/calendario/connettori in parallelo dove possibile → inbox e visual parity.
