# RBAC, permessi stringa e enforcement (Followup 3.0 POC)

Obiettivo: descrivere **in modo verificabile** come il POC costruisce i permessi nel JWT, come le route li applicano, e l’incrocio con **membership workspace** e **ruoli legacy**. Include **edge case** e **buchi** noti rispetto a un modello enterprise.

**Mapping verso permessi/ruoli BSS legacy:** non è in questo file; va costruito dopo spike e tabella di mapping (owner PO + Security). Traccia operativa: `11-bss-legacy-bridge-api-and-data-matrix.md` (§2 riga RBAC, §3, §4).

---

## 1) Principio architetturale

- Il controllo accessi sulle route REST usa **stringhe permesso** (`PERMISSIONS.*`), non il solo “nome ruolo”.
- Il payload JWT contiene `permissions: string[]` e flag `isAdmin` se è presente `*`.
- Se l’utente ha **membership workspace**, i permessi JWT possono essere calcolati dalla **unione** dei permessi dei ruoli membership (con regole di merge).

---

## 2) Registry permessi (estratto)

Fonte: `be-followup-v3/src/core/rbac/permissions.ts` — elenco completo nel file (decine di chiavi per modulo: `users`, `clients`, `apartments`, `requests`, `calendar`, …).

Wildcard:

```87:88:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/rbac/permissions.ts
  /** Wildcard: tutti i permessi */
  ALL: "*"
```

---

## 3) Fallback permessi per ruolo “builtin” (senza DB ruoli)

```100:142:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/rbac/permissions.ts
export const BUILTIN_ROLE_PERMISSIONS: Record<string, string[] | typeof PERMISSIONS.ALL> = {
  admin: PERMISSIONS.ALL,
  owner: PERMISSIONS.ALL,
  collaborator: [
    PERMISSIONS.APARTMENTS_READ,
    // ... CRM operativo ...
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE
  ],
  viewer: [
    PERMISSIONS.APARTMENTS_READ,
    PERMISSIONS.POST_DELIVERY_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.INTEGRATIONS_READ,
    PERMISSIONS.REPORTS_READ
  ],
  /** Utente senza ruolo noto: solo lettura base */
  user: [PERMISSIONS.APARTMENTS_READ, PERMISSIONS.POST_DELIVERY_READ]
};
```

**Nota PO:** `collaborator` **non** include `USERS_*` nel builtin: invitare utenti richiede ruolo DB diverso o override.

---

## 4) Merge JWT: workspace membership vs ruolo legacy

Logica centrale in `buildAccessPayloadFromUserDoc`:

```80:106:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/auth/userAccessPayload.ts
  const memberships = await listWorkspaceMembershipsForUser(email);
  let perms: string[];
  let role: string | null;

  if (memberships.length > 0) {
    const allPerms = new Set<string>();
    const roles: string[] = [];
    for (const m of memberships) {
      const rolePerms = await getPermissionsForRole(m.role);
      if (rolePerms === PERMISSIONS.ALL || (Array.isArray(rolePerms) && rolePerms.includes(PERMISSIONS.ALL))) {
        allPerms.add(PERMISSIONS.ALL);
      } else if (Array.isArray(rolePerms)) {
        for (const p of rolePerms) allPerms.add(p);
      }
      roles.push(m.role);
    }
    if (allPerms.has(PERMISSIONS.ALL)) {
      perms = [PERMISSIONS.ALL];
    } else {
      perms = mergeRoleAndOverrides([...allPerms], user.permissions_override);
    }
    role = maxRole(roles);
  } else {
    const legacyRole = (user.role || "").toLowerCase() || null;
    perms = await resolveEffectivePermissions(legacyRole, user.permissions_override);
    role = legacyRole;
  }
```

### 4.1 Ordine “massimo” ruolo membership

```10:17:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/auth/userAccessPayload.ts
const ROLE_ORDER: Record<string, number> = {
  admin: 100,
  owner: 95,
  collaborator: 45,
  viewer: 10,
  user: 0
};
```

### 4.2 Tecma admin

Se `system_role === tecma_admin` → JWT con `permissions: ["*"]` (bypass logica membership). Vedi stesso file, ramo iniziale.

---

## 5) Enforcement HTTP (middleware)

### 5.1 `requirePermission` / `requireAnyPermission`

```6:34:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/routes/permissionMiddleware.ts
export function requirePermission(...required: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, new HttpError("Unauthorized", 401));
      return;
    }
    const granted = req.user.permissions ?? [];
    if (!hasAllPermissions(granted, required)) {
      sendError(res, new HttpError("Permesso negato", 403));
      return;
    }
    next();
  };
}
```

### 5.2 `requirePermissionOrTecmaAdmin`

Bypass esplicito per `system_role === tecma_admin` o `isTecmaAdmin`.

### 5.3 Semantica wildcard

```147:160:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/rbac/permissions.ts
export function hasPermission(granted: string[], required: PermissionId | string): boolean {
  if (granted.includes(PERMISSIONS.ALL)) return true;
  return granted.includes(required);
}

export function hasAllPermissions(granted: string[], required: string[]): boolean {
  if (granted.includes(PERMISSIONS.ALL)) return true;
  return required.every((p) => granted.includes(p));
}
```

---

## 6) Matrice “route pattern → permesso” (estratto operativo)

> Per lista completa: grep `requirePermission(` / `requireAnyPermission(` su `be-followup-v3/src/routes`.

| Area | Pattern permesso | Esempio |
|------|------------------|---------|
| Invito utente | `users.invite` OR `users.create` | `POST /v1/users` |
| Connettori | `integrations.read` / `update` / `delete` | `connectors.routes.ts` |
| Workspace admin | `requireAdmin` (da non confondere con stringa permesso) | `workspaces.routes.ts` |

**Attenzione:** alcune aree usano **`requireAdmin`** (ruolo applicativo) invece di una stringa `PERMISSIONS.*` — va documentato per QA (due modelli di gate).

---

## 7) Incrocio RBAC × workspace × liste CRM

| Dimensione | Effetto su JWT | Effetto su liste (clients/apartments/…) |
|------------|------------------|------------------------------------------|
| Permessi stringa | determina se la route risponde **403** | non filtra righe per conto proprio |
| Membership workspace | altera set permessi | non diretto |
| `access_scope` membership | **non** nel JWT; letto a runtime sulle query | deve filtrare (gap noto se non implementato ovunque) |

**Implicazione:** una matrice permessi “solo JWT” è **insufficiente**: serve la matrice in `07` §4 + test liste.

---

## 8) Edge case e gap (checklist)

| ID | Descrizione | Note / azione |
|----|-------------|---------------|
| E-R-01 | Utente con membership in **due** workspace con ruoli diversi | Permessi = **unione**; `role` JWT = `maxRole` — può sorprendere il FE se mostra un solo ruolo |
| E-R-02 | `permissions_override` su utente con membership | `mergeRoleAndOverrides` aggiunge permessi extra |
| E-R-03 | Ruolo workspace “vendor” mappato altrove | verificare mapping in `workspace-users.service` (normalizzazione ruoli) |
| E-R-04 | Route protetta da `requireAdmin` ma JWT senza `isAdmin` | 403 anche se permessi CRM ampi — gap UX |
| E-R-05 | `PERMISSIONS.ALL` vs membership parziale | Se una membership dà `*`, JWT diventa admin globale per quel token |

---

## 9) Backlog PO / Security

### Epic RBAC-1 — Modello unico di gate

- Story: catalogare ogni router con `requireAdmin` vs `requirePermission` e decidere target unico per 3.1.

### Epic RBAC-2 — Documentazione permessi per ruolo workspace

- Story: tabella `getPermissionsForRole` (DB) + fallback builtin per ogni ruolo workspace usato in produzione.

---

## 10) Riferimenti

- `src/core/rbac/permissions.ts`
- `src/core/rbac/roleDefinitions.service.ts`
- `src/core/auth/userAccessPayload.ts`
- `src/routes/permissionMiddleware.ts`

## 11) Test negativi JWT / permessi (matrice minima)

Ogni permesso `PERMISSIONS.*` usato in una route esposta deve avere almeno **un** test automatico “consentito” e **uno** “negato”. Casi trasversali da coprire in staging:

| Caso | Comportamento atteso | Nota |
|------|----------------------|------|
| JWT firmato con secret errato | 401 | non confondere con 403 |
| Ruolo workspace `viewer` chiama mutazione | 403 | messaggio coerente con `ErrorResponse` |
| `access_scope=assigned` su lista clients | solo record assegnati | allineare con `01`, `07` §9 |
| Token BSS iniettato su route solo-Followup | 401 o 403 documentato | dipende da `AUTH_MODE`, tabella in `03` |
| Permesso `*` (admin) vs membership mancante | definito da prodotto | esplicitare in ADR + test |

Tracciare gli ID caso nella tabella `07` §9b (colonna “ID test”). Per merge gateway che aggiunge header permessi, aggiungere voce in `05` contract testing.
