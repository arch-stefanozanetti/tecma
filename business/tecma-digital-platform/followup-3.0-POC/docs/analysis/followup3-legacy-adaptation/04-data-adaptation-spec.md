# Spec dati — Legacy source of truth read/write + `tz_*` additive

## Scopo

Definire una strategia dati che rispetti:

- **legacy Mongo read/write** come fonte primaria dei dati “core BSS”
- **Mongo additivo** (cluster/DB dedicato) solo per capability nuove non coperte dal legacy

## Definizioni

- **DB Legacy (Primary DB)**: Mongo legacy read/write per domini esistenti.
- **DB Additivo (Capability DB)**: Mongo per collection `tz_*` realmente additive (workspace layer, metadata, audit esteso, ecc.).

## Decisione architetturale (default)

**Percorso approvato — legacy-first:**

- `LEGACY_MONGO_URI` / `LEGACY_MONGO_DB_NAME` → **Primary DB** (read/write domini legacy)
- `FOLLOWUP_ADDITIVE_MONGO_URI` / `FOLLOWUP_ADDITIVE_MONGO_DB_NAME` → **Capability DB** (`tz_*` additive)

Motivazione: separare ownership dati e cicli di vita, evitando CRM paralleli non governati.

Il modello greenfield del POC resta fuori scope per il target 3.1 approvato.

## Inventario “tz_*” (baseline POC)

### Lista operativa usata dagli script di unificazione test

```7:54:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/utils/unifyMainDb.ts
/** Collection tz_* usate in test-zanetti (nessun riferimento a DB/collection esterne). */
const TZ_COLLECTIONS = [
  "tz_projects",
  "tz_workspaces",
  "tz_workspace_projects",
  "tz_workspace_user_projects",
  "tz_entity_assignments",
  "tz_additional_infos",
  "tz_requests",
  "tz_request_transitions",
  "tz_request_actions",
  "tz_authEvents",
  "tz_authSessions",
  "tz_workflow_configs",
  "tz_project_policies",
  "tz_project_email_config",
  "tz_project_email_templates",
  "tz_project_pdf_templates",
  "tz_audit_log",
  "tz_clients",
  "tz_apartments",
  "tz_catalog_buildings",
  "tz_catalog_floor_plans",
  "tz_catalog_unit_profiles",
  "tz_inventory",
  "tz_commercial_models",
  "tz_rate_plans",
  "tz_sale_prices",
  "tz_monthly_rents",
  "tz_price_calendar",
  "tz_contracts",
  "tz_users",
  "tz_quotes",
  "tz_calendar_events",
  "tz_ai_suggestions",
  "tz_ai_suggestion_approvals",
  "tz_ai_action_drafts",
  "tz_domain_events",
  "tz_tasks",
  "tz_reminders_queue",
  "tz_apartment_client_associations",
  "tz_hc_apartments",
  "tz_configuration_templates",
  "tz_complete_flow_runs",
  "tz_customer_needs",
  "tz_opportunities",
  "tz_initiatives",
  "tz_features",
];
```

### Indici attesi (campanello di “write DB”)

Il POC ha una lista estesa di indici core (`ensureIndexes.ts`), ad esempio:

```11:18:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/config/ensureIndexes.ts
const CORE_INDEXES: IndexDefinition[] = [
  // Core list queries: workspace + project + default sort (updatedAt)
  { collection: "tz_clients", keys: { workspaceId: 1, projectId: 1, updatedAt: -1 } },
  // ...
];
```

**Implicazione:** gli indici delle collection additive devono essere gestiti nel Capability DB; per il legacy gli indici seguono le policy del dominio legacy.

## Classificazione collection (ownership)

### A) **Workspace / tenancy** (Capability DB)

Tutte le seguenti devono restare nel Capability DB:

- `tz_workspaces`
- `tz_workspace_projects`
- `tz_workspace_user_projects`
- `tz_user_workspaces` (nota: non è inclusa nella lista `unifyMainDb`, ma è parte del core multi-tenant)
- `tz_project_access` (se usata)
- `tz_entity_assignments`
- `tz_workspace_entitlements`, `tz_workspace_ai_config`, `tz_platform_api_keys`, `tz_platform_api_usage`, …

### B) **Auth/session/security** (primary o capability secondo policy Security)

Esempi già presenti nel codice:

- `tz_authSessions` (`refreshSession.service.ts`)
- `tz_account_lockout` (`accountLockout.service.ts`)
- `tz_authEvents` (audit auth)

### C) **CRM nativo / moduli prodotto** (default: Primary DB legacy)

Esempi:

- `clients`, `apartments`, `requests`, `quotes` legacy (via contratti/servizi approvati)

**Regola target 3.1:** evitare CRM parallelo su `tz_clients`/`tz_apartments`/`tz_requests` salvo eccezioni deliberate e approvate.

### D) **Identità utente** (`tz_users` vs legacy collections)

Oggi il login cerca utenti in una lista di collection candidate (`USER_COLLECTION_CANDIDATES` in `userAccessPayload.ts`), mentre `getProjectAccessByEmail` usa `tz_users` come hardcoded.

**Decisione dati richiesta:**

- identità canonical da legacy/BSS;
- `tz_users` solo projection/cache governata o estensione per capability non coperte;
- serve una view/materializzazione o mapping che unifica identità durante la transizione.

## Mapping identità: email → userId stabile

### Problema

`tz_user_workspaces.userId` è email in Fase 1:

```1:6:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/workspace-users.service.ts
/**
 * ...
 * userId = email (string) per Fase 1; in futuro ObjectId hex da tz_users.
 */
```

### Piano di stabilizzazione identità

1. Aggiungere (nel Capability DB) una tabella di mapping opzionale, es. `tz_identity_links`:
   - `emailLower`
   - `legacyUserObjectId` (se noto)
   - `tzUserId` (ObjectId string)
2. Backfill: job offline che popola mapping usando dati legacy/BSS.
3. Cutover:
   - nuove membership usano `tzUserId`
   - lettura accetta entrambi per un periodo (compat)

## Mapping progetti: `projectId` BSS vs `_id` in `tz_projects`

Il POC già contempla `legacyProjectId` in `tz_projects` (usato per filtri workspace in `getProjectAccessByEmail`).

**Requisito dati**

- ogni progetto “Followup” che referenzia legacy deve avere:
  - `legacyProjectId` **oppure**
  - `_id` uguale al projectId BSS (solo se garantito stabile)

## Linee guida operative (OPS / DBA)

### Backup & retention

- Capability DB: backup standard + retention policy per `tz_authSessions` (token hash) e audit.
- Legacy DB: backup/policy secondo standard legacy + controlli permessi per separazione ruoli.

### Sicurezza accessi

- principi separati:
  - app runtime: scrive sul legacy solo tramite percorsi approvati
  - job batch: no bypass non governati, no credenziali “wide” senza approval

### Indici

- indici `tz_*` additive nel Capability DB; per legacy vale la governance DBA legacy.

## Criteri di accettazione (dati)

- È possibile avviare `be-followup-v3` con:
  - Primary DB legacy read/write operativo per domini legacy
  - Capability DB per collection additive `tz_*`
- Le route dei domini legacy scrivono su legacy (tramite canali approvati) senza usare storage parallelo non governato.
- È documentato **un** schema di mapping `projectId` ↔ `legacyProjectId` validato su almeno 3 progetti reali (rent/sell/mixed).

## Rischi

- **Drift** tra dati CRM nativi (`tz_clients`) e client legacy BSS se coesistono senza regole.
- **Doppia identità** (legacy user doc vs `tz_users`) finché non viene chiuso il modello canonical.
- **Uso improprio del POC greenfield** come target dati, se non viene ribadito che i domini legacy devono restare sul legacy.

## QA integrità dati (reconciliation e invarianti)

- **Job notturni** (cfr. `07` §7 Fase 1): report su discrepanze `tz_workspace_users` vs elenco utenti attivi legacy per `projectId`; owner QA firma lettura report settimanale in periodo transizione email→id.
- **Invarianti consigliati** (da codificare come query o test data):
  - ogni `projectId` in `tz_workspace_projects` deve esistere in `tz_projects` (o equivalente legacy post-spike `11`);
  - nessun documento `tz_inviteTokens` con `usedAt` valorizzato e utente ancora `pending` incoerente con regole `08`;
  - vincoli unique su `(workspaceId, email)` per inviti pending se la policy prodotto lo richiede.
- **Rollback dati**: script di compensazione (delete soft / flag) documentati nel runbook `07` §2 — non eseguire fix manuali in prod senza voce in audit (`08`/`10`).
