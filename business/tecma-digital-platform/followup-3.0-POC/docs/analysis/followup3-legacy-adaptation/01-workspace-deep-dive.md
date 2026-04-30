# Deep dive — Workspace / multi-tenant / assegnazioni / session (Followup 3.0 POC)

## Executive summary (per CTO)

Il POC Followup 3.0 introduce un **layer multi-tenant** basato su Mongo (`tz_workspaces` + tabelle di join `tz_*`) che **non esiste nel BSS legacy** come concetto omogeneo: oggi è la “spina dorsale” per segregare dati CRM nativi, permessi, UI modularità, AI, ecc.

Per Followup 3.1 (target) il legacy va considerato **source of truth read/write** per i domini già esistenti.  
Conseguenza: il dominio workspace va mantenuto come layer applicativo (oggi `tz_*`), ma deve essere allineato ai flussi legacy/BSS quando impatta utenti/progetti/permessi.

## Glossario (termini usati dal POC)

- **Workspace**: contenitore tenant logico (`tz_workspaces`).
- **Membership**: appartenenza di un utente a un workspace (`tz_user_workspaces`).
- **Workspace↔Progetto**: associazione many-to-many tra workspace e projectId (`tz_workspace_projects`).
- **Progetti visibili per utente nel workspace**: overlay opzionale (`tz_workspace_user_projects`) — se assente, l’utente “eredita” tutti i progetti del workspace.
- **Assegnazione entità**: mapping (client/apartment) → utente (`tz_entity_assignments`) con semantica “upsert per entità”.
- **Project access cross-workspace**: tabella di collaborazione (`tz_project_access`) usata dal controllo accessi ai progetti.
- **Session preferences**: stato UI/server-side per workspace+progetti selezionati (servizio dedicato, vedi `session.routes.ts`).

## Superficie API (BE) — cosa espone oggi il POC

Il router workspace centralizza CRUD workspace, membership, join progetti, assignments, entitlements, AI config, platform keys, ecc.

```77:119:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/routes/v1/workspaces.routes.ts
workspacesRoutes.get(
  "/workspaces",
  // route-guard: workspace-list-self-filtered (filtro membership in handler)
  handleAsync(async (req) => {
    const all = await listWorkspaces();
    const isAdmin = req.user?.isAdmin === true;
    const isTecma = req.user?.system_role === "tecma_admin" || req.user?.isTecmaAdmin === true;
    const email = typeof req.user?.email === "string" ? req.user.email : "";
    if (isAdmin || isTecma || !email) return all;
    const allowedIds = await listWorkspaceIdsForUser(email);
    const set = new Set(allowedIds);
    return all.filter((w) => set.has(w._id));
  })
);

workspacesRoutes.get(
  "/workspaces/:id/users",
  requireCanAccessWorkspace("id"),
  handleAsync((req) => listWorkspaceUsers(req.params.id))
);
workspacesRoutes.post(
  "/workspaces/:id/users",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const body = req.body as { userId?: string; role?: string };
    const userId = body.userId ?? "";
    const role = toMembershipRole(body.role ?? "vendor");
    const result = await addWorkspaceUser(workspaceId, { userId, role });
    safeAsync(
      auditRecord({
        action: "workspace.membership.created",
        workspaceId,
        entityType: "workspace_membership",
        entityId: userId,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { role },
      }),
      { operation: "audit.workspace.membership.created", workspaceId, entityId: userId, userId: req.user?.sub }
    );
    return result;
  })
);
```

### Regole di autorizzazione “macro” osservabili dal codice

- **Lista workspace**: se l’utente non è admin/Tecma, viene **filtrata** dai workspace in cui ha membership.
- **Dettagli / operazioni dentro un workspace**: middleware `requireCanAccessWorkspace` (basato su `canAccess`, vedi sezione successiva).
- **Operazioni amministrative** (creazione workspace, membership write, assignments write): richiedono `requireAdmin` (ruolo applicativo admin) oltre all’accesso workspace dove applicabile.

## Modello dati — membership (`tz_user_workspaces`)

### Semantica

Il service definisce esplicitamente:

- ruoli membership: `owner | admin | collaborator | viewer`
- `access_scope`: `"all" | "assigned"` (toggle UI)
- **Fase 1**: `userId` è **email** normalizzata lowercase

```95:114:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/workspace-users.service.ts
/** Restituisce le membership workspace dell'utente (userId = email). Usato per derivare permessi JWT. */
export const listWorkspaceMembershipsForUser = async (
  userId: string
): Promise<{ workspaceId: string; role: WorkspaceUserRole }[]> => {
  const uid = userId.trim().toLowerCase();
  if (!uid) return [];
  await ensureUniqueIndex();
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ userId: uid })
    .project({ workspaceId: 1, role: 1 })
    .toArray();
  return (docs as { workspaceId?: string; role?: string }[])
    .filter((d) => typeof d.workspaceId === "string")
    .map((d) => ({
      workspaceId: d.workspaceId!,
      role: normalizeRoleToSpec(d.role)
    }));
};
```

### Implicazioni per il rifacimento “legacy read/write”

- La membership workspace non ha equivalente nativo nel legacy BSS: può restare in collection dedicate (`tz_*`) come dominio additivo.
- Il binding `userId = email` è pragmatico ma fragile (casi email duplicate, cambi email, merge account): la spec dati (`04`) deve definire una migrazione tecnica a **ID stabile**.

## Modello dati — progetti per utente nel workspace (`tz_workspace_user_projects`)

```1:39:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/workspace-user-projects.service.ts
/**
 * Progetti visibili per utente nel workspace (tz_workspace_user_projects).
 * Se nessun record per (workspaceId, userId) l'utente vede tutti i progetti del workspace.
 */
export const listWorkspaceUserProjects = async (
  workspaceId: string,
  userId: string
): Promise<{ data: string[] }> => {
  const uid = userId.trim().toLowerCase();
  if (!workspaceId.trim() || !uid) return { data: [] };
  await ensureIndex();
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId, userId: uid })
    .project({ projectId: 1 })
    .toArray();
  const data = (docs as { projectId?: unknown }[])
    .map((d) => (typeof d.projectId === "string" ? d.projectId : String(d.projectId ?? "")))
    .filter(Boolean);
  return { data };
};
```

**Semantica chiave:** assenza di righe ⇒ **nessuna restrizione** (full workspace project list). Presenza di righe ⇒ **intersezione** (usata anche in `getProjectAccessByEmail`).

## Modello dati — assegnazioni entità (`tz_entity_assignments`)

```95:129:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/entity-assignments.service.ts
export const assignEntity = async (
  workspaceId: string,
  entityType: string,
  entityId: string,
  userId: string
): Promise<{ assignment: EntityAssignmentRow }> => {
  const type = normalizeEntityType(entityType);
  const eid = (entityId ?? "").trim();
  const uid = (userId ?? "").trim().toLowerCase();
  if (!workspaceId.trim() || !type || !eid || !uid) {
    throw new HttpError("workspaceId, entityType, entityId e userId obbligatori", 400);
  }
  await ensureIndex();
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const now = new Date().toISOString();
  const doc = { workspaceId, entityType: type, entityId: eid, userId: uid, createdAt: now };
  const res = await coll.findOneAndUpdate(
    { workspaceId, entityType: type, entityId: eid },
    { $set: { ...doc, updatedAt: now } },
    { upsert: true, returnDocument: "after" }
  );
  const out = res as (EntityAssignmentRow & { _id?: unknown }) | null;
  if (!out) throw new HttpError("Assegnazione non creata", 500);
  return {
    assignment: {
      _id: String(out._id ?? ""),
      workspaceId: out.workspaceId,
      entityType: out.entityType,
      entityId: out.entityId,
      userId: out.userId,
      createdAt: out.createdAt,
    },
  };
};
```

## Enforcement “liste CRM” (clienti/appartamenti) + gap noto su `access_scope`

Il POC applica un filtro basato su assignment per utenti non-admin:

```1:22:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/entity-assignment-query.util.ts
/**
 * Viewer context per filtrare liste cliente/appartamento in base a tz_entity_assignments (PIANO_GLOBALE §3.2).
 * Regola: entità senza riga di assegnazione nel workspace → visibili a tutti;
 * se esiste assegnazione → visibile solo all’utente assegnato (e admin/Tecma).
 */
export function shouldApplyEntityAssignmentListFilter(viewer: EntityAssignmentListViewer | undefined): boolean {
  if (!viewer) return false;
  if (viewer.isTecmaAdmin) return false;
  if (viewer.isAdmin) return false;
  return true;
}
```

Esempio pipeline clienti:

```194:218:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/clients/clients.service.ts
if (shouldApplyEntityAssignmentListFilter(viewer)) {
  const wid = input.workspaceId;
  const viewerId = viewerAssignmentUserId(viewer!);
  const lookupAndVisibility: Document[] = [
    {
      $lookup: {
        from: "tz_entity_assignments",
        let: { cid: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              workspaceId: wid,
              entityType: "client",
              $expr: { $eq: ["$entityId", "$$cid"] },
            },
          },
        ],
        as: "__ea",
      },
    },
    {
      $match: {
        $or: [{ __ea: { $size: 0 } }, { "__ea.0.userId": viewerId }],
      },
    },
  ];
  // ...
}
```

### Gap funzionale importante (da gestire in re-implementazione)

La UI e il modello membership espongono `access_scope` (“Tutto / Solo assegnati”), ma **il filtro liste sopra non legge `access_scope`**: `toEntityAssignmentListViewer` passa solo email + flag admin.

```4:11:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/routes/helpers/listQueryViewer.ts
export function toEntityAssignmentListViewer(user: AccessTokenPayload | undefined): EntityAssignmentListViewer | undefined {
  if (!user?.email) return undefined;
  return {
    email: user.email,
    isAdmin: user.isAdmin,
    isTecmaAdmin: user.isTecmaAdmin === true,
  };
}
```

**Conseguenza:** oggi il toggle “Solo assegnati” è **parzialmente non enforcement-driven** lato liste (almeno per clients/apartments), anche se i dati persistono su `tz_user_workspaces`.

Per il porting legacy, questo va risolto esplicitamente (vedi `03`): definire semantica unica e allineare UI↔BE.

## Controllo accessi centralizzato (`canAccess`)

`canAccess` implementa:

1. bypass Tecma admin
2. workspace ⇒ membership (`listWorkspaceIdsForUser` con chiave email)
3. project ⇒ complessità: owner workspace su `tz_projects.workspace_id`, oppure join `tz_workspace_projects`, oppure `tz_project_access`

```40:86:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/access/canAccess.ts
export async function canAccess(user: AccessUser, resource: Resource): Promise<boolean> {
  if (!user?.sub && !user?.email) return false;
  if (isTecmaAdmin(user)) return true;

  if (resource.type === "workspace") {
    const workspaceIds = await listWorkspaceIdsForUser(userMemberKey(user));
    return workspaceIds.includes(resource.workspaceId);
  }

  if (resource.type === "project") {
    const db = getDb();
    const memberKey = userMemberKey(user);
    const workspaceIds = await listWorkspaceIdsForUser(memberKey);
    if (workspaceIds.length === 0) return false;

    const projectId = resource.projectId.trim();
    if (!projectId) return false;

    const projectsColl = db.collection(COLLECTION_PROJECTS);
    const project = await projectsColl.findOne(
      { $or: [{ _id: projectId as unknown }, { id: projectId }] } as Record<string, unknown>,
      { projection: { workspace_id: 1, _id: 1 } }
    );

    let ownerWorkspaceId: string | null = null;
    if (project) {
      const p = project as unknown as { workspace_id?: string; _id?: string };
      ownerWorkspaceId = typeof p.workspace_id === "string" && p.workspace_id ? p.workspace_id : null;
    }
    if (!ownerWorkspaceId) {
      const wpColl = db.collection(COLLECTION_WORKSPACE_PROJECTS);
      const wp = await wpColl.findOne({ projectId });
      ownerWorkspaceId = wp ? String((wp as { workspaceId?: string }).workspaceId ?? "") : null;
    }
    if (ownerWorkspaceId && workspaceIds.includes(ownerWorkspaceId)) return true;

    const paColl = db.collection(COLLECTION_PROJECT_ACCESS);
    const projectAccessList = await paColl.find({ project_id: projectId }).toArray();
    for (const pa of projectAccessList) {
      const wid = String((pa as { workspace_id?: string }).workspace_id ?? "");
      if (wid && workspaceIds.includes(wid)) return true;
    }
    return false;
  }

  return false;
}
```

### Implicazioni legacy/BSS

Nel mondo BSS, il “project scope” è spesso innestato nel token/login (`project_id`). Nel POC invece il project scope è **dinamico** (multi-progetto) e governato da:

- membership workspace
- overlay `tz_workspace_user_projects`
- preferenze sessione
- permessi JWT derivati da membership (`buildAccessPayloadFromUserDoc`)

Questo è uno dei punti caldi di integrazione (dettagliata in `02` e `05`).

## Session — `projects-by-email` e preferenze

### Endpoint

```38:90:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/routes/v1/session.routes.ts
sessionRoutes.post(
  "/session/projects-by-email",
  requireSessionTargetEmail((r) => {
    const e = (r.body as { email?: unknown })?.email;
    return typeof e === "string" ? e : undefined;
  }),
  handleAsync((req) => getProjectAccessByEmail(req.body))
);

sessionRoutes.get(
  "/session/preferences",
  requireSessionTargetEmail((r) => {
    const q = r.query.email;
    return typeof q === "string" ? q : undefined;
  }),
  handleAsync(async (req) => {
    const email = typeof req.query.email === "string" ? req.query.email : "";
    if (!email) throw new HttpError("Missing email query param", 400);
    const prefs = await getUserPreferences(email);
    if (!prefs) return { found: false };
    return {
      found: true,
      email: prefs.email,
      workspaceId: prefs.workspaceId,
      selectedProjectIds: prefs.selectedProjectIds,
      updatedAt: prefs.updatedAt,
    };
  })
);

sessionRoutes.post(
  "/session/preferences",
  requireSessionTargetEmail((r) => {
    const e = (r.body as { email?: unknown })?.email;
    return typeof e === "string" ? e : undefined;
  }),
  handleAsync(async (req) => {
    const body = z
      .object({
        email: z.string().email(),
        workspaceId: z.string().min(1),
        selectedProjectIds: z.array(z.string().min(1)).min(1),
      })
      .parse(req.body);
    const prefs = await upsertUserPreferences(body.email, body.workspaceId, body.selectedProjectIds);
    return {
      email: prefs.email,
      workspaceId: prefs.workspaceId,
      selectedProjectIds: prefs.selectedProjectIds,
      updatedAt: prefs.updatedAt,
    };
  })
);
```

### Semantica progetti (merge `tz_projects` + project DB + filtri workspace)

`getProjectAccessByEmail` oggi:

- legge utente da `tz_users` (hardcoded collection nel service)
- merge tra progetti “project DB” e `tz_projects`
- se `workspaceId` è passato, interseca con `tz_workspace_projects`
- se non admin e ci sono righe in `tz_workspace_user_projects`, ulteriore intersezione

```35:193:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/auth/projectAccess.service.ts
/** Solo collection presenti in test-zanetti. */
const USERS_COLLECTION = "tz_users";
const PROJECTS_COLLECTION = "tz_projects";
const WORKSPACE_PROJECTS_COLLECTION = "tz_workspace_projects";

export const getProjectAccessByEmail = async (rawInput: unknown) => {
  const { email, workspaceId: rawWorkspaceId } = InputSchema.parse(rawInput);
  const workspaceId = rawWorkspaceId?.trim() || undefined;
  const db = getDb();

  const usersCollection = db.collection<UserDoc>(USERS_COLLECTION);
  const projectsCollection = db.collection<ProjectDoc>(PROJECTS_COLLECTION);

  const user = await usersCollection.findOne({
    email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });

  if (!user) {
    return {
      found: false,
      email,
      role: null,
      isAdmin: false,
      projects: []
    };
  }

  const role = String(user.role || "").toLowerCase();
  const isTecmaAdmin = user.system_role === "tecma_admin";
  const isAdmin = role === "admin" || isTecmaAdmin;

  let projectsFromProjectDb: ProjectDoc[] = [];
  let projectsFromTz: ProjectDoc[] = [];

  if (isAdmin) {
    const [fromProjectDb, fromTz] = await Promise.all([
      projectsCollection
        .find({ archived: { $ne: true }, isCommercialDemo: { $ne: true } })
        .project({ _id: 1, name: 1, displayName: 1, mode: 1, broker: 1 })
        .toArray() as Promise<ProjectDoc[]>,
      fetchTzProjects().catch(() => []),
    ]);
    projectsFromProjectDb = fromProjectDb;
    projectsFromTz = fromTz;
  } else {
    const projectIds = (user.project_ids || []).map(normalizeId);
    if (projectIds.length > 0) {
      const objectIds = projectIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      const [fromProjectDb, fromTz] = await Promise.all([
        projectsCollection
          .find({
            $or: [{ _id: { $in: objectIds } }, { _id: { $in: projectIds } }],
            archived: { $ne: true }
          })
          .project({ _id: 1, name: 1, displayName: 1, mode: 1, broker: 1 })
          .toArray() as Promise<ProjectDoc[]>,
        fetchTzProjects(projectIds).catch(() => []),
      ]);
      projectsFromProjectDb = fromProjectDb;
      projectsFromTz = fromTz;
    }
  }

  const byId = new Map<string, ProjectDoc>();
  for (const p of [...projectsFromProjectDb, ...projectsFromTz]) {
    const id = normalizeId(p._id ?? "");
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, p);
      continue;
    }
    // Prefer fields from tz_projects when duplicate ids exist.
    byId.set(id, {
      ...prev,
      ...p,
      _id: prev._id ?? p._id,
    });
  }
  const merged = [...byId.values()];

  const allNormalizedProjects = merged.map(buildProjectOutput).sort((a, b) => a.displayName.localeCompare(b.displayName));
  let normalizedProjects = allNormalizedProjects;

  if (workspaceId) {
    const inWorkspace = await loadWorkspaceProjectIds(workspaceId);
    if (inWorkspace.length > 0) {
      const wsSet = new Set(inWorkspace);
      normalizedProjects = normalizedProjects.filter((p) => {
        if (wsSet.has(p.id)) return true;
        const matchedById = merged.find((m) => normalizeId(m._id ?? "") === p.id);
        return typeof matchedById?.legacyProjectId === "string" && wsSet.has(matchedById.legacyProjectId);
      });
    }
    if (!isAdmin && inWorkspace.length > 0) {
      const emailKey = email.trim().toLowerCase();
      const { data: userProjectIds } = await listWorkspaceUserProjects(workspaceId, emailKey);
      if (userProjectIds.length > 0) {
        const allowed = new Set(userProjectIds);
        normalizedProjects = normalizedProjects.filter((p) => allowed.has(p.id));
      }
    }
    // Hardening: evita lockout admin se i riferimenti projectId nel workspace sono incoerenti.
    if (isAdmin && normalizedProjects.length === 0 && allNormalizedProjects.length > 0) {
      normalizedProjects = allNormalizedProjects;
    }
  }

  return {
    found: true,
    email,
    role: role || null,
    isAdmin,
    projects: normalizedProjects
  };
};
```

**Nota di porting:** `login` usa ancora una discovery “multi-collection” per utenti legacy (`USER_COLLECTION_CANDIDATES` in `auth.service.ts`), mentre `projects-by-email` è agganciato a `tz_users`. Questo è un rischio reale di **inconsistenza identità** in ambienti ibridi.

## Workspace “bootstrap” (comportamento POC)

`listWorkspaces` crea workspace default se la collection è vuota:

```66:102:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/workspaces/workspaces.service.ts
const DEFAULT_WORKSPACES = [
  { name: "Dev-1" },
  { name: "Demo" },
  { name: "Production" },
];

/** Se la collection è vuota, crea i workspace di default (Dev-1, Demo, Production). */
async function ensureDefaultWorkspaces(): Promise<void> {
  const db = getDb();
  const coll = db.collection(COLLECTION_WORKSPACES);
  const count = await coll.countDocuments();
  if (count > 0) return;
  const now = new Date().toISOString();
  await coll.insertMany(
    DEFAULT_WORKSPACES.map((w) => ({
      name: w.name,
      createdAt: now,
      updatedAt: now,
    }))
  );
}
```

Per un ambiente enterprise questo comportamento va considerato **solo dev/stage** oppure rimosso: non deve mai “auto-seedare” tenant in produzione.

## Conclusioni per la fase di adattamento

1. Il dominio workspace è un dominio applicativo additivo (`tz_*`) che deve restare coerente con utenti/progetti legacy senza duplicare il CRM legacy.
2. Il vero lavoro di integrazione non è “clonare workspace nel legacy”, ma definire **punti di aggancio**:
   - `projectId` legacy vs `_id`/`legacyProjectId` in `tz_projects`
   - permessi JWT Followup vs permessi BSS (`role`, `project_ids`, `TwoFA`, ecc.)
3. Esistono gap funzionali da chiudere (`access_scope` vs filtri liste) prima di replicare la UX in produzione.

## QA, sicurezza e tracciabilità (punti caldi di questo documento)

- **Inconsistenza identità** (`login` multi-collection vs `projects-by-email` su `tz_users`): classificare come rischio **P0** in matrice `07` §9b finché non esiste piano unico (`08`, spike `11`).
- **Bootstrap workspace** (`ensureDefaultWorkspaces`): in staging/prod deve essere disabilitato o protetto da feature flag; test che verificano “nessun insert automatico” in ambiente `NODE_ENV=production` (o equivalente).
- **`userHasProjectAccess`**: ogni modifica alla risoluzione `workspace_id` / `tz_workspace_projects` / `tz_project_access` richiede test di regressione su tre casi — membro semplice, admin workspace, utente con scope progetto limitato (`12`).
- **Sessione multi-progetto**: E2E minimo che alterna progetto A/B e verifica header/token o stato FE coerente con permessi JWT (`09`).
