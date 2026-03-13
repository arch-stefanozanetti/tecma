# Schema Main DB (test-zanetti)

Documentazione dello schema del database principale Followup 3.0. Tutte le collection sono nel main DB (test-zanetti) salvo indicazione contraria.

## Principi

- **Scrittura solo su main DB**: mai scrivere su project/client/asset DB legacy
- **Legacy = sola lettura**: usare per capire cosa serve, non per strutturare il nuovo schema
- **Schema pulito**: collection `tz_*` con campi chiari, tipi coerenti, indici appropriati
- **Nessuna ridondanza**: evitare frammentazione e campi ridondanti del legacy

## Convenzioni

- `projectId`: string (ObjectId hex o id custom come `fake-sell-01`)
- `workspaceId`: string (ObjectId hex per tz_workspaces, oppure `dev-1`/`demo`/`prod` per legacy)
- Date: ISO string (`createdAt`, `updatedAt`) dove applicabile

---

## 1. Collection esistenti

### 1.1 Collection `tz_*` (main DB)

| Collection | Scopo | Chiavi principali |
|------------|-------|-------------------|
| `tz_projects` | Progetti creati da Followup | `_id`, `name`, `displayName`, `mode`, `hostKey`, `assetKey` |
| `tz_workspaces` | Workspace | `_id`, `name`, `createdAt`, `updatedAt` |
| `tz_workspace_projects` | Associazione workspace ↔ progetto | `workspaceId`, `projectId` (compound unique) |
| `tz_additional_infos` | Campi custom clienti per workspace | `workspaceId`, `name`, `type`, `label` |
| `tz_authEvents` | Eventi autenticazione (login, logout, sso) | `_id`, `at`, `event`, `email` |
| `tz_authSessions` | Sessioni refresh token | `_id`, `refreshToken`, `userId`, `expiresAt` |
| `tz_requests` | Richieste/trattative (main) | `workspaceId`, `projectId`, `clientId`, `type`, `status` |
| `tz_request_transitions` | Storico transizioni richieste | `requestId`, `fromStatus`, `toStatus`, `at` |
| `tz_workflow_configs` | Configurazioni workflow | `projectId`, `workspaceId`, config |

### 1.2 Collection dati (main DB)

| Collection | Scopo | Chiavi principali |
|------------|-------|-------------------|
| `clients` | Clienti | `workspaceId`, `projectId`, `_id`, `fullName`, `email`, `status` |
| `apartments` | Appartamenti | `workspaceId`, `projectId`, `_id`, `code`, `status` |
| `apartment_client_associations` | Associazioni apt-cliente | `workspaceId`, `projectId`, `apartmentId`, `clientId` |
| `configuration_templates` | Template sezioni HC per progetto | `projectId`, `workspaceId`, `template` |
| `calendar_events` | Eventi calendario | `workspaceId`, `projectId`, `_id` |
| `domain_events` | Eventi dominio (template.saved, association.*, hc.*, ai.*) | `_id`, `type`, `at`, `payload` |

### 1.3 Collection AI / supporto

| Collection | Scopo | Chiavi principali |
|------------|-------|-------------------|
| `ai_action_drafts` | Bozze azioni AI | `_id`, `workspaceId`, `projectId` |
| `ai_suggestions` | Suggerimenti AI | `_id`, `workspaceId`, `projectId` |
| `ai_suggestion_approvals` | Approvazioni suggerimenti | `_id`, `suggestionId` |
| `tasks` | Task generati da AI | `_id`, `workspaceId` |
| `reminders_queue` | Coda promemoria | `_id`, `taskId` |

---

## 2. Nuove collection per config progetto (da implementare)

| Collection | Scopo | Schema chiave |
|------------|-------|---------------|
| `tz_project_policies` | Privacy policy, termini | `projectId` (unique), `privacyPolicyUrl?`, `termsUrl?`, `content?`, `updatedAt` |
| `tz_project_email_config` | Credenziali SMTP + template default | `projectId` (unique), `smtpHost?`, `smtpPort?`, `fromEmail?`, `defaultTemplateId?`, `updatedAt` |
| `tz_project_email_templates` | Template email per progetto | `projectId`, `name`, `subject`, `bodyHtml`, `bodyText?`, `createdAt`, `updatedAt` |
| `tz_project_pdf_templates` | Template PDF (es. preventivi) | `projectId`, `name`, `templateKey`, `config` (JSON), `updatedAt` |

**Indici suggeriti:**
- `tz_project_policies`: unique su `projectId`
- `tz_project_email_config`: unique su `projectId`
- `tz_project_email_templates`: compound `(projectId, name)` unique
- `tz_project_pdf_templates`: compound `(projectId, templateKey)` unique

---

## 3. Collection future (proposte)

### 3.1 Ruoli e visibilità

| Collection | Scopo | Schema chiave |
|------------|-------|---------------|
| `tz_user_workspaces` | Associazione utente → uno o più workspace (user-centric). Per “utenti del workspace” si interroga per workspaceId. | `userId`, `workspaceId`, `role` (vendor \| vendor_manager \| admin), createdAt, updatedAt |
| `tz_workspace_user_projects` | Progetti visibili per utente | `workspaceId`, `userId`, `projectId` (compound unique) |
| `tz_entity_assignments` | Assegnazione cliente/appartamento a utenti | `workspaceId`, `entityType`, `entityId`, `userId` |

### 3.2 Audit log

| Collection | Scopo | Schema chiave |
|------------|-------|---------------|
| `tz_audit_log` | Audit CRUD clienti, appartamenti, richieste, associazioni | `_id`, `at`, `actor`, `action`, `workspaceId`, `projectId?`, `entityType`, `entityId`, `payload`, `ip?` |

**Azioni da tracciare:** `client.created`, `client.updated`, `client.deleted`, `apartment.created`, `apartment.updated`, `apartment.deleted`, `request.created`, `request.status_changed`, `association.created`, `association.deleted`, ecc.

---

## 4. Indici raccomandati

```javascript
// tz_workspace_projects
db.tz_workspace_projects.createIndex({ workspaceId: 1, projectId: 1 }, { unique: true });
db.tz_workspace_projects.createIndex({ workspaceId: 1 });

// clients
db.clients.createIndex({ workspaceId: 1, projectId: 1 });
db.clients.createIndex({ workspaceId: 1 });

// apartments
db.apartments.createIndex({ workspaceId: 1, projectId: 1 });
db.apartments.createIndex({ workspaceId: 1 });

// apartment_client_associations
db.apartment_client_associations.createIndex({ workspaceId: 1, projectId: 1 });
db.apartment_client_associations.createIndex({ apartmentId: 1, clientId: 1 });

// tz_audit_log (futuro)
db.tz_audit_log.createIndex({ workspaceId: 1, at: -1 });
db.tz_audit_log.createIndex({ entityType: 1, entityId: 1, at: -1 });
```

---

## 5. Riferimenti

- Piano: `progetto_dettaglio_ruoli_legacy_65174474.plan.md`
- Ruoli e visibilità: `docs/ROLES_AND_VISIBILITY_DESIGN.md` (da creare)
- Modello clienti/appartamenti: `docs/CLIENT_APARTMENT_MODEL.md`
