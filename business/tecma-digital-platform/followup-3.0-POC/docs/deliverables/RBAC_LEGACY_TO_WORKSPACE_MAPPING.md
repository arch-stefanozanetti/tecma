# Mapping ruoli legacy → workspace FollowUp 3.0

**Scopo:** tradurre ruoli e legami **progetto-centrici** del legacy nel modello attuale: **workspace**, **`user.workspaces[]`**, **`tz_workspace_user_projects`**, **`tz_roleDefinitions`**, **`permissions_override`** su utente.

**Riferimenti codice:** [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) §3; [`permissions.ts`](../../be-followup-v3/src/core/rbac/permissions.ts) (`BUILTIN_ROLE_PERMISSIONS`, `PERMISSIONS`); [`roleDefinitions.service.ts`](../../be-followup-v3/src/core/rbac/roleDefinitions.service.ts).

---

## Principi

1. **Permessi nel codice** usano stringhe `clients.read`, `requests.update`, … — non il nome commerciale del ruolo legacy.
2. Ruoli workspace **builtin tipici:** `owner`, `admin`, `collaborator`, `viewer` (+ estensioni in `tz_roleDefinitions`).
3. Se un utente legacy era **vincolato a un sottoinsieme di progetti**, replicare con **`tz_workspace_user_projects`** (lista esplicita; lista vuota = “tutti i progetti del workspace” secondo comportamento documentato nel piano globale per admin).
4. Ruoli legacy “commerciali” (vendor, vendor manager, front office, …) **non** devono essere reintrodotti come stringhe opache: mappare su **(roleKey, permessi)** o **template ruolo** + override.

---

## Matrice (template — compilare con i valori reali del legacy)

| Ruolo legacy (nome in DB) | Descrizione operativa legacy | roleKey workspace suggerito | Progetti | Permessi extra / override | Note |
|---------------------------|------------------------------|----------------------------|----------|---------------------------|------|
| _esempio_ vendor | | `collaborator` | subset | `clients.assign` | validare con commerciale |
| | | | | | |
| | | | | | |

---

## Evidenza reale ruoli legacy (`user.users`)

Distribuzione rilevata (snapshot 2026-03-26):

| Ruolo legacy | Utenti |
|--------------|-------:|
| `client` | 1107 |
| `vendor_manager` | 560 |
| `vendor` | 193 |
| `admin` | 90 |
| `proprieta` | 42 |
| `account_manager` | 42 |
| `front_office` | 40 |
| `building_manager` | 11 |
| `user` | 3 |
| `configuration_manager` | 3 |

Campi legacy utili per mapping:

- `role` (stringa ruolo legacy)
- `project_ids` (array ObjectId, vincolo per progetto)
- `isLightAdmin` (flag da convertire in permessi/roleKey)
- `isDisabled`, `notificationLanguage`, `locale` (metadati account)

## Mapping di partenza suggerito (da validare con Product/CTO)

| Ruolo legacy | roleKey workspace default | Vincolo progetti | Override consigliato |
|--------------|---------------------------|------------------|----------------------|
| `vendor_manager` | `collaborator` | sì (subset) | `clients.assign`, `requests.assign` |
| `vendor` | `viewer` o `collaborator` (in base alle azioni) | sì (subset) | `requests.update` opzionale |
| `front_office` | `collaborator` | sì (subset) | `clients.create`, `clients.update` |
| `account_manager` | `admin` o role custom | no / selettivo | in base a governance commerciale |
| `building_manager` | `viewer` | sì (subset) | `apartments.read` (+ update se richiesto) |
| `client` | utente non operativo CRM | n/a | normalmente non migrare come utente backoffice |

Questo mapping è una base tecnica: il significato business finale dei ruoli va ratificato con stakeholder.

---

## Utenti con più progetti o più workspace

- **Stesso utente, più workspace:** più entry in `user.workspaces[]` (una per workspace) con ruolo per workspace.
- **Stesso workspace, più progetti:** righe in `tz_workspace_user_projects` o lista vuota se deve vedere tutto.

---

## Deliverable

Documento approvato da Product + CTO; aggiornare `tz_roleDefinitions` in staging prima del carico pilota; eseguire `yarn migrate:role-definitions:reconcile` dove previsto dal [README backend](../../README.md).
