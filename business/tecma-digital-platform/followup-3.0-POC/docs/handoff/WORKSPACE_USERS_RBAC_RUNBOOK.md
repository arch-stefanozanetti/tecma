# Workspace / Users / RBAC Runbook Operativo

## Obiettivo
Runbook pratico per implementare o rifare i flussi principali senza reinterpretare il POC.

## Flussi coperti
1. Login + bootstrap sessione
2. Selezione workspace/progetti
3. Gestione utenti workspace (invite/add/update/remove)
4. Assegnazione progetti per utente
5. Enforcement RBAC su endpoint e UI
6. Revoke access e deprovisioning

---

## 1) Login + bootstrap sessione

### FE
- `LoginPage` esegue login e salva token.
- `App` verifica token presente; senza token redirect login.
- `http.ts` gestisce refresh e retry su 401.

### BE
- `authMiddleware` valida JWT.
- `auth.routes.ts` espone `me`, `refresh`, MFA flow.

### Acceptance
- Con token valido, `GET /v1/auth/me` risponde 200.
- Con token scaduto, refresh funziona o redirect login pulito.
- Nessun endpoint protetto accessibile senza bearer valido.

---

## 2) Selezione workspace e project scope

### FE
- `ProjectAccessPage` carica progetti visibili utente.
- Salva scope in `projectScope` client-side.
- Salva preferenze server-side (`session/preferences`).

### BE
- `POST /v1/session/projects-by-email`
- `GET/POST /v1/session/preferences`

### Rischio noto POC
- Scope lato FE è utile UX, ma non sicurezza.
- Sicurezza deve restare lato BE con `canAccess`/middleware.

### Acceptance
- Cambio workspace aggiorna progetti visibili.
- Scope vuoto blocca accesso feature progettuali.
- Scope persistito e ricaricato al nuovo login.

---

## 3) Gestione utenti workspace

### FE
- `UsersPage` gestisce lista utenti, invito, ruolo, override, associazioni.

### BE
- `workspaces.routes.ts` + `users-admin.routes.ts` per CRUD e membership.
- `workspace-users.service.ts` su `tz_user_workspaces`.

### Checklist implementativa
- Input normalizzato (`email` lowercase).
- Ruoli ammessi solo da catalogo (`owner/admin/collaborator/viewer`).
- Audit evento su azioni sensibili (invite, role change, revoke).
- Endpoint sempre protetti da permission middleware appropriato.

### Acceptance
- Add user workspace crea membership unica.
- Doppio inserimento stesso `(workspaceId,userId)` torna 409/gestione idempotente.
- Update ruolo visibile subito su effective permissions.
- Remove membership revoca accesso endpoint tenant.

---

## 4) Assegnazione progetti per utente

### BE
- `workspace-user-projects.service.ts` su `tz_workspace_user_projects`.
- Vincolo unico `(workspaceId,userId,projectId)`.
- Validazione: progetto deve esistere in `tz_workspace_projects`.

### Regola attuale POC
- Se nessuna riga di assignment per utente, fallback: tutti i progetti workspace.

### Raccomandazione rebuild
- Rendere fallback esplicito e configurabile (default deny o default allow deciso a tavolino).

### Acceptance
- Add assignment su progetto non appartenente al workspace -> 400.
- Remove assignment rimuove visibilità progetto target.
- Query lista progetti utente riflette stato aggiornato.

---

## 5) Enforcement RBAC

### Livello route (obbligatorio)
- `requireAuth`
- `requirePermission` / `requireAnyPermission`
- `requireCanAccessWorkspace` / `requireCanAccessProject` quando resource scoped

### Livello service (difesa in profondità)
- validazione coerenza workspace-project (`ensureProjectInWorkspace` o equivalente target-state)

### FE
- gating route/menu per UX
- mai considerare FE come confine sicurezza

### Acceptance
- Utente senza permesso -> 403 coerente.
- Utente con permesso ma fuori workspace -> 403/404 coerente.
- Tecma admin behavior documentato e testato separatamente.

---

## 6) Revoke access / deprovisioning

### Passi minimi
1. Rimuovere membership workspace (`tz_user_workspaces`).
2. Rimuovere assegnazioni progetto (`tz_workspace_user_projects`).
3. Invalidare sessione se previsto (refresh/session revocation).
4. Registrare audit event.

### Acceptance
- Utente revocato non vede più workspace né dati associati.
- API ritorna denied su risorse vecchio workspace.
- Nessuna orphan permission efficace dopo revoke.

---

## Test matrix QA (minima ma sufficiente)

| Caso | Aspettativa |
|---|---|
| login valido | token e `me` OK |
| login senza permesso | 403 su endpoint protetti |
| workspace switch | dati filtrati correttamente |
| role downgrade admin->viewer | azioni admin non più consentite |
| user revoke | nessun accesso tenant residuo |
| project assignment remove | progetto non più visibile |
| entitlement OFF + permission ON | feature non accessibile |
| permission ON + entitlement OFF | feature non accessibile |

---

## Prompt Cursor/AI per esecuzione task

### Prompt 1 — BE endpoint hardening
```txt
Analizza route <path> e applica policy standard:
1) requireAuth
2) requirePermission coerente con action
3) requireCanAccessWorkspace/Project se resource scoped
4) test integrazione per deny/allow.
Non cambiare contratto API se non necessario.
```

### Prompt 2 — FE gating alignment
```txt
Allinea FE gating con permessi backend per sezione <section>.
Aggiorna route config, menu visibility e command palette.
Mantieni UX coerente ma non assumere sicurezza lato FE.
Aggiungi test unit per visibilità azioni.
```

### Prompt 3 — Membership consistency
```txt
Rivedi flusso membership workspace/progetti.
Garantisci normalizzazione userId, idempotenza add/remove, error handling 400/409.
Aggiungi test su duplicate insert, project fuori workspace e revoke.
```
