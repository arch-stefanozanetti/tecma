# Matrice gap — Followup 3.0 (POC) vs BSS legacy (TECMA-BSS)

Questo documento incrocia **API**, **dati**, **permessi/sessione** e **multi-tenant workspace** tra:

- **POC**: `be-followup-v3` + `fe-followup-v3` + Mongo `tz_*` + sessioni refresh locali.
- **Legacy/BSS**: contratti TECMA-BSS (OpenAPI public/raw) + flussi gateway documentati internamente.

> Nota: per auth “as-is” su gateway, la fonte più completa lato integrazioni AWS è spesso il **raw** OpenAPI; il **public** swagger può risultare **parzialmente disallineato** su shape response (es. `/login`). Quando c’è ambiguità, la decisione va risolta con **prova runtime** su ambiente e aggiornamento contratto.

## A) Auth / sessione / “me”

### A1 — Confronto endpoint (POC vs BSS)

| Capabilità | POC Followup (`be-followup-v3`) | BSS / Gateway (TECMA-BSS) | Gap / decisione |
|---|---|---|---|
| Login password | `POST /v1/auth/login` (`public.routes.ts`) | `POST /login` richiede `email`, `password`, **`project_id`** (public swagger + report raw) | **Mismatch progetto**: Followup consente login senza `project_id`; BSS no. Serve strategia unica (`03`, `05`). |
| Refresh | `POST /v1/auth/refresh` (refresh opaco in `tz_authSessions`) | `POST /v1/auth/refresh-token` (presente nel raw; vedi `AUTH_AND_TECMA_BSS_API_REPORT.md`) | Due famiglie di token: **opaco+hash** vs **refresh BSS**. Non mescolare senza bridge esplicito. |
| “Me” | `GET /v1/auth/me` (non coperto in questo estratto; presente nelle addizioni gateway) | `POST /v1/users/getUserByJWT` (raw; usato dal FE adapter) | Divergenza verbosa ma gestibile con adapter FE/BE. |
| SSO | `POST /v1/auth/sso-exchange` | non standard BSS (manca nel core; tipicamente addizione) | Richiede **path additivo** in TECMA-BSS verso Followup (già proposto). |

Riferimento interno già consolidato:

- `followup-3.0/docs/AUTH_AND_TECMA_BSS_API_REPORT.md` (tabella raw paths + analisi hybrid).

### A2 — Flusso FE: modalità “Followup API” vs “BSS auth”

#### Modalità Followup API (default)

Il FE chiama direttamente:

```48:53:tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/api/followupApi.ts
async function postAuthLogin(email: string, password: string): Promise<FollowupLoginResponse> {
  const res = await fetch(`${resolveApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password })
  });
```

#### Modalità BSS (gateway)

Adapter dedicato:

```82:110:tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/api/bssAuthAdapter.ts
export async function loginBss(
  email: string,
  password: string,
  projectId: string
): Promise<BssLoginResponse> {
  const gatewayBase = getGatewayBaseUrl();
  const url = `${gatewayBase}/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, project_id: projectId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Login BSS fallito ${res.status}`);
  }
  const raw = (await res.json()) as BssLoginRaw;
  const token = raw.token;
  const accessToken = token?.accessToken ?? "";
  const refreshToken = token?.refreshToken ?? "";
  if (!accessToken) throw new Error("Risposta BSS senza accessToken");
  const user = mapBssUserToApp(raw.user);
  return {
    accessToken,
    refreshToken,
    expiresIn: token?.expiresIn,
    user
  };
}
```

**Implicazione prodotto:** l’app già contiene **due mondi**; in produzione va scelto *uno* come source-of-truth del token, e l’altro eventualmente come fallback (solo se accettato dal security model).

### A3 — Flusso BE: costruzione JWT e permessi

Il login POC valida password su documento utente “legacy shape” (bcrypt) e costruisce payload JWT:

- lookup utente via `USER_COLLECTION_CANDIDATES` (`auth.service.ts`)
- permessi:
  - se membership workspace presenti ⇒ merge permessi per ruolo membership
  - altrimenti fallback ruolo legacy + override

```57:119:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/auth/userAccessPayload.ts
export async function buildAccessPayloadFromUserDoc(
  user: UserDocForAccessPayload,
  emailFallback: string
): Promise<AccessTokenPayload> {
  const email = (user.email || emailFallback).trim().toLowerCase();
  const system_role = user.system_role === "tecma_admin" ? "tecma_admin" : null;
  const isTecmaAdmin = system_role === "tecma_admin";
  const projectId =
    Array.isArray(user.project_ids) && user.project_ids.length > 0 ? String(user.project_ids[0]) : null;

  if (isTecmaAdmin) {
    return {
      sub: user._id.toHexString(),
      email,
      role: "admin",
      isAdmin: true,
      permissions: ["*"],
      projectId,
      system_role,
      isTecmaAdmin
    };
  }

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

  const isAdmin = perms.includes(PERMISSIONS.ALL);
  return {
    sub: user._id.toHexString(),
    email,
    role,
    isAdmin,
    permissions: perms,
    projectId,
    system_role,
    isTecmaAdmin
  };
}
```

**Gap permessi vs BSS:** BSS tendenzialmente ragiona per `role` + `project_ids` “da user object”; Followup POC ragiona per **permission strings** (`PERMISSIONS.*`) + membership workspace.

### A4 — Session: progetti per email + preferenze

Endpoint:

```38:45:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/routes/v1/session.routes.ts
sessionRoutes.post(
  "/session/projects-by-email",
  requireSessionTargetEmail((r) => {
    const e = (r.body as { email?: unknown })?.email;
    return typeof e === "string" ? e : undefined;
  }),
  handleAsync((req) => getProjectAccessByEmail(req.body))
);
```

**Gap BSS:** non esiste un equivalente “standard” documentato nel public swagger per sostituire questo endpoint; tipicamente serve:

- addizione gateway → Followup (`openapi-tecma-bss-additions.yaml` già lo prevede), oppure
- nuovo endpoint BSS “core” (se il team legacy lo introduce).

### A5 — Refresh/session store POC (scritture)

Il refresh token opaco persistito:

```6:52:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/auth/refreshSession.service.ts
const COLLECTION_NAME = "tz_authSessions";

export async function createSession(userId: string, email?: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const doc: OptionalId<AuthSessionDoc> = {
    userId,
    email,
    tokenHash,
    expiresAt: expiresAtDate(),
    createdAt: now()
  };
  await getCollection().insertOne(doc as AuthSessionDoc);
  return token;
}
```

**Nota 3.1:** questa collection nel POC è su `tz_authSessions`; nel target 3.1 va allineata al modello session legacy approvato (oppure mantenuta additive solo se esplicitamente accettata da Security/Platform).

## B) Multi-tenant workspace (POC) vs BSS legacy

| Concetto POC | Implementazione POC | Equivalente legacy | Gap |
|---|---|---|---|
| Workspace | `tz_workspaces` + default seed (`workspaces.service.ts`) | non presente come primitive unica | **Nuovo dominio** da hostare fuori legacy |
| Membership | `tz_user_workspaces` (userId email fase 1) | ruoli/progetti utente spesso nel modello user legacy | mapping identità |
| Workspace↔Project | `tz_workspace_projects` | BSS usa `project_id` nel login e path `/v2/.../project/{projectId}` | serve mappatura stabile projectId |
| Scope progetto per utente | overlay `tz_workspace_user_projects` | legacy: `project_ids` / permessi | duplicazione informativa: definire “source of truth” |
| Accesso a progetto “non owner” | `tz_project_access` + `canAccess` | legacy potrebbe avere meccanismi diversi | rischio divergenza autorizzazioni |
| Assegnazioni CRM | `tz_entity_assignments` + pipeline liste | legacy potrebbe non avere stessa semantica | definire policy unica |

## C) API CRM / dominio dati: pattern REST “/v2/.../project/{projectId}” vs query POST `/v1/.../query`

### C1 — Esempi path BSS (public swagger)

```285:324:tecma/architecture/aws-api-gateway/api/TECMA-BSS/public/tecma-bss-swagger.yaml
paths:
  /login:
    post:
      tags:
        - Authentication
      summary: User Login
      description: Logs a user into the system and returns a Bearer token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  description: The user name for login
                password:
                  type: string
                  description: The password for login in clear text
                project_id:
                  type: string
                  description: The project id
      responses:
        '200':
          description: 200 response
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken:
                    type: string
      security:
        - api_key: []
  /v2/movements/project/{projectId}:
    get:
      tags:
        - Movements
      operationId: getMovements
```

### C2 — Esempi path Followup esposti via addizioni BSS (proxy HTTP)

```6:33:tecma/business/tecma-digital-platform/followup-3.0/docs/openapi-tecma-bss-additions.yaml
paths:
  /v1/session/projects-by-email:
    post:
      summary: "Resolve projects by user email"
      responses:
        "200": { description: "OK" }
        "400": { description: "Validation error" }
        "500": { description: "Server error" }
      x-amazon-apigateway-integration:
        type: "http"
        httpMethod: "POST"
        uri: "http://${stageVariables.url}/v1/session/projects-by-email"
        responses:
          "200*": { statusCode: "200" }
          "400*": { statusCode: "400" }
          "500*": { statusCode: "500" }
        passthroughBehavior: "when_no_match"
```

**Gap architetturale:** il POC introduce un layer “application API” (`/v1/...`) progettato per FE moderno; BSS espone ancora molto mondo `/v2/...` “resource-per-project”.

Strategie ammissibili (dettaglio in `03`/`05`):

1. **Adapter interno nel BE Followup** (preferito): FE resta su `/v1/...`, BE legge/scrive legacy via BSS dove serve.
2. **Riscrittura FE** verso `/v2/...` (costoso; duplica logica filtering già nel POC).

## D) Permessi: stringhe `PERMISSIONS.*` vs ruoli legacy

Il POC ha registry permessi esteso:

```1:22:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/rbac/permissions.ts
/** Registry permessi — i check nel codice usano queste stringhe, non ruoli. */
export const PERMISSIONS = {
  USERS_READ: "users.read",
  // ...
  CLIENTS_READ: "clients.read",
  // ...
  APARTMENTS_READ: "apartments.read",
```

**Gap:** in assenza di membership workspace, i permessi derivano dal ruolo legacy (`resolveEffectivePermissions`). In presenza membership, i permessi derivano dal ruolo workspace.

Per integrazione BSS serve una mappa esplicita (esempi di domande da chiudere):

- un `vendor` legacy corrisponde a `collaborator` workspace?
- un `admin` legacy implica `permissions=["*"]` anche se non ha membership?

## E) Gap “bloccanti” vs “gestibili”

### Bloccanti (se non risolti, non si può andare in prod 3.1)

1. **Storage scritture** (`tz_authSessions`, lockout, MFA, audit, workspace tables…) non allineato al modello legacy/BSS target.
2. **Scelta auth** unica: token BSS vs JWT Followup (o bridge formalizzato).
3. **Identità utente**: mismatch `USER_COLLECTION_CANDIDATES` vs `getProjectAccessByEmail` hardcoded su `tz_users`.

### Gestibili con adapter/contratti

1. `/v1/users/getUserByJWT` vs `/v1/auth/me` (mapping).
2. Proxy gateway verso Followup per session endpoints (già proposto).
3. Normalizzazione risposte `/login` (public vs raw vs runtime).

## F) Checklist di verifica (QA / arch)

- **Auth**
  - login BSS con `project_id` valido restituisce token utilizzabile su 2–3 endpoint `/v2/...` rappresentativi.
  - login Followup senza `project_id` + `session/projects-by-email` restituisce lista progetti coerente con `project_ids` legacy.
  - refresh: prova cross (BSS refresh vs Followup refresh) secondo la strategia scelta.
- **Workspace**
  - utente senza membership non vede workspace altrui (`/workspaces` filtered).
  - utente con membership ma senza `tz_workspace_user_projects` vede tutti i progetti workspace (regola attesa).
- **Assignments**
  - entità senza assignment è visibile a tutti i non-admin (`entity-assignment-query.util.ts`).
  - entità con assignment è visibile solo all’assegnatario.

## G) Tracciabilità sicurezza / QA sui gap (uso con `07` §9b)

Per ogni riga della matrice in §A–§D che è classificata **Bloccante** o **Richiede contratto gateway**, il team deve aggiungere in backlog almeno: (1) un **test API** su staging con token realistico, (2) un **test negativo** (401/403/404 atteso), (3) un riferimento al paragrafo del pack (es. `02` §B + `11` §2 riga X). Le colonne “ID req / ID test” vivono nella tabella template `07` §9b così da non disperdere la tracciabilità tra Confluence e Jira.

| Tema gap | Rischio se non coperto da test | Doc di approfondimento |
|----------|-------------------------------|-------------------------|
| Doppia identità login vs `projects-by-email` | utente vede progetti errati o lista vuota | `01` conclusioni, `08` §4 |
| `access_scope=assigned` vs liste | leakage dati CRM | `01`, `07` §9 |
| Proxy gateway → BE Followup | superficie SSRF/authz network | `05`, `03` |
| Invito senza membership workspace | utenti orfani, escalation supporto | `10`, `07` §2.1 |
