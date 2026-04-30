/**
 * Workflow engine: modello normalizzato Workflow / WorkflowState / WorkflowTransition.
 * Usato per stati e transizioni configurabili per workspace (piano FU3 workflow/state machine).
 * Fase 1: API lettura + validazione transizioni da config; Request continua a usare status string.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION_WORKFLOWS = "tz_workflows";
const COLLECTION_STATES = "tz_workflow_states";
const COLLECTION_TRANSITIONS = "tz_workflow_transitions";
const COLLECTION_REQUESTS = "tz_requests";
const COLLECTION_APARTMENT_LOCKS = "tz_apartment_locks";
const COLLECTION_PROJECT_WORKFLOW_SETTINGS = "tz_project_workflow_settings";

function workflowTypeMatchesRequest(wfType: WorkflowType, requestType: "rent" | "sell"): boolean {
  if (wfType === "custom") return true;
  return wfType === requestType;
}

export type ApartmentLockType = "none" | "soft" | "hard";
export type WorkflowType = "sell" | "rent" | "custom";

export interface WorkflowRow {
  _id: string;
  workspaceId: string;
  name: string;
  type: WorkflowType;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStateRow {
  _id: string;
  workflowId: string;
  code: string;
  label: string;
  order: number;
  terminal: boolean;
  reversible: boolean;
  apartmentLock: ApartmentLockType;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTransitionRow {
  _id: string;
  workflowId: string;
  fromStateId: string;
  toStateId: string;
  createdAt: string;
}

/** DTO per FE: workflow con stati e transizioni (per pulsanti e roadmap). */
export interface WorkflowWithDetail {
  workflow: WorkflowRow;
  states: WorkflowStateRow[];
  transitions: WorkflowTransitionRow[];
}

/** Configurazione in-memory per validazione transizioni (modulo puro, testabile). */
export interface WorkflowTransitionConfig {
  fromStateId: string;
  toStateId: string;
}
export interface WorkflowStateConfig {
  id: string;
  code: string;
  terminal: boolean;
  reversible: boolean;
  apartmentLock: ApartmentLockType;
}
export interface WorkflowValidationConfig {
  statesByCode: Map<string, WorkflowStateConfig>;
  statesById: Map<string, WorkflowStateConfig>;
  allowedFromTo: Set<string>; // key: `${fromStateId}_${toStateId}`
}

function toWorkflowRow(d: { _id: ObjectId; workspaceId?: string; name?: string; type?: string; createdAt?: unknown; updatedAt?: unknown }): WorkflowRow {
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    workspaceId: d.workspaceId ?? "",
    name: d.name ?? "",
    type: (d.type === "rent" || d.type === "sell" || d.type === "custom" ? d.type : "custom") as WorkflowType,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : (d.updatedAt instanceof Date ? d.updatedAt.toISOString() : ""),
  };
}

function toStateRow(d: { _id: ObjectId; workflowId?: string; code?: string; label?: string; order?: number; terminal?: boolean; reversible?: boolean; apartmentLock?: string; createdAt?: unknown; updatedAt?: unknown }): WorkflowStateRow {
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    workflowId: d.workflowId ?? "",
    code: d.code ?? "",
    label: d.label ?? "",
    order: typeof d.order === "number" ? d.order : 0,
    terminal: Boolean(d.terminal),
    reversible: Boolean(d.reversible),
    apartmentLock: (d.apartmentLock === "soft" || d.apartmentLock === "hard" ? d.apartmentLock : "none") as ApartmentLockType,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : (d.updatedAt instanceof Date ? d.updatedAt.toISOString() : ""),
  };
}

function toTransitionRow(d: { _id: ObjectId; workflowId?: string; fromStateId?: string; toStateId?: string; createdAt?: unknown }): WorkflowTransitionRow {
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    workflowId: d.workflowId ?? "",
    fromStateId: d.fromStateId ?? "",
    toStateId: d.toStateId ?? "",
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
  };
}

/**
 * Lista workflow per workspace (ordinati per nome).
 */
export const listWorkflowsByWorkspace = async (workspaceId: string): Promise<{ workflows: WorkflowRow[] }> => {
  if (!workspaceId) return { workflows: [] };
  const db = getDb();
  const coll = db.collection(COLLECTION_WORKFLOWS);
  const docs = await coll.find({ workspaceId }).sort({ name: 1 }).toArray();
  const workflows = docs.map((d: Record<string, unknown>) => toWorkflowRow(d as Parameters<typeof toWorkflowRow>[0]));
  return { workflows };
};

/**
 * Workflow con stati e transizioni (per FE: pulsanti e roadmap).
 */
export const getWorkflowWithStatesAndTransitions = async (workflowId: string): Promise<WorkflowWithDetail | null> => {
  if (!workflowId || !ObjectId.isValid(workflowId)) return null;
  const db = getDb();
  const wfColl = db.collection(COLLECTION_WORKFLOWS);
  const wfDoc = await wfColl.findOne({ _id: new ObjectId(workflowId) });
  if (!wfDoc) return null;

  const statesColl = db.collection(COLLECTION_STATES);
  const transColl = db.collection(COLLECTION_TRANSITIONS);
  const [stateDocs, transDocs] = await Promise.all([
    statesColl.find({ workflowId: workflowId as string }).sort({ order: 1 }).toArray(),
    transColl.find({ workflowId: workflowId as string }).toArray(),
  ]);

  const workflow = toWorkflowRow(wfDoc as Parameters<typeof toWorkflowRow>[0]);
  const states = stateDocs.map((d: Record<string, unknown>) => toStateRow(d as Parameters<typeof toStateRow>[0]));
  const transitions = transDocs.map((d: Record<string, unknown>) => toTransitionRow(d as Parameters<typeof toTransitionRow>[0]));

  return { workflow, states, transitions };
};

/**
 * Restituisce il workflow da usare per validare transizioni per un dato workspace e tipo (rent/sell).
 * Se `projectId` è valorizzato e esiste override in tz_project_workflow_settings, usa quel workflow
 * (stesso workspace, tipo compatibile). Altrimenti il primo workflow del tipo per quel workspace.
 */
export const getWorkflowForWorkspaceAndType = async (
  workspaceId: string,
  type: "rent" | "sell",
  projectId?: string
): Promise<WorkflowWithDetail | null> => {
  if (!workspaceId) return null;
  const db = getDb();

  if (projectId) {
    const settingsDoc = await db.collection(COLLECTION_PROJECT_WORKFLOW_SETTINGS).findOne({ projectId });
    if (
      settingsDoc &&
      typeof settingsDoc.workspaceId === "string" &&
      settingsDoc.workspaceId === workspaceId &&
      typeof settingsDoc.workflowId === "string" &&
      ObjectId.isValid(settingsDoc.workflowId)
    ) {
      const overrideDetail = await getWorkflowWithStatesAndTransitions(settingsDoc.workflowId);
      if (
        overrideDetail &&
        overrideDetail.workflow.workspaceId === workspaceId &&
        workflowTypeMatchesRequest(overrideDetail.workflow.type, type)
      ) {
        return overrideDetail;
      }
    }
  }

  const coll = db.collection(COLLECTION_WORKFLOWS);
  const wfDoc = await coll.findOne({ workspaceId, type: type as string });
  if (!wfDoc) return null;
  const id = wfDoc._id instanceof ObjectId ? wfDoc._id.toHexString() : String(wfDoc._id);
  return getWorkflowWithStatesAndTransitions(id);
};

/**
 * Costruisce config in-memory per validazione (modulo puro, testabile).
 */
export function buildValidationConfig(detail: WorkflowWithDetail): WorkflowValidationConfig {
  const statesByCode = new Map<string, WorkflowStateConfig>();
  const statesById = new Map<string, WorkflowStateConfig>();
  for (const s of detail.states) {
    const c: WorkflowStateConfig = {
      id: s._id,
      code: s.code,
      terminal: s.terminal,
      reversible: s.reversible,
      apartmentLock: s.apartmentLock,
    };
    statesByCode.set(s.code, c);
    statesById.set(s._id, c);
  }
  const allowedFromTo = new Set<string>();
  for (const t of detail.transitions) {
    allowedFromTo.add(`${t.fromStateId}_${t.toStateId}`);
  }
  return { statesByCode, statesById, allowedFromTo };
}

/**
 * Verifica se la transizione da fromStatusCode a toStatusCode è consentita nel workflow.
 * Usa i code degli stati (es. "new", "contacted", "offer").
 */
export function isTransitionAllowed(
  config: WorkflowValidationConfig,
  fromStatusCode: string,
  toStatusCode: string
): boolean {
  const fromState = config.statesByCode.get(fromStatusCode);
  const toState = config.statesByCode.get(toStatusCode);
  if (!fromState || !toState) return false;
  return config.allowedFromTo.has(`${fromState.id}_${toState.id}`);
}

/**
 * Restituisce lo stato (con apartmentLock) per un dato code nel workflow detail.
 */
export function getStateByCode(detail: WorkflowWithDetail, statusCode: string): WorkflowStateRow | null {
  return detail.states.find((s) => s.code === statusCode) ?? null;
}

/**
 * Dato workspace e tipo request, restituisce se la transizione è consentita dalla config workflow.
 * In modalità hard-cut non esiste fallback legacy: senza workflow ritorna false.
 */
export const isTransitionAllowedForWorkspace = async (
  workspaceId: string,
  requestType: "rent" | "sell",
  fromStatus: string,
  toStatus: string,
  projectId?: string
): Promise<boolean> => {
  const detail = await getWorkflowForWorkspaceAndType(workspaceId, requestType, projectId);
  if (!detail) return false;
  const config = buildValidationConfig(detail);
  return isTransitionAllowed(config, fromStatus, toStatus);
};

// ─── CRUD (solo admin workspace) ─────────────────────────────────────────────

export const createWorkflow = async (body: { workspaceId: string; name: string; type: WorkflowType }): Promise<{ workflow: WorkflowRow }> => {
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    workspaceId: body.workspaceId,
    name: body.name ?? "Workflow",
    type: body.type ?? "custom",
    createdAt: now,
    updatedAt: now,
  };
  const res = await db.collection(COLLECTION_WORKFLOWS).insertOne(doc);
  const id = res.insertedId.toHexString();
  const row = toWorkflowRow({ _id: res.insertedId, ...doc });
  return { workflow: row };
};

export const createWorkflowState = async (body: {
  workflowId: string;
  code: string;
  label: string;
  order: number;
  terminal?: boolean;
  reversible?: boolean;
  apartmentLock?: ApartmentLockType;
}): Promise<{ state: WorkflowStateRow }> => {
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    workflowId: body.workflowId,
    code: body.code,
    label: body.label ?? body.code,
    order: typeof body.order === "number" ? body.order : 0,
    terminal: Boolean(body.terminal),
    reversible: Boolean(body.reversible),
    apartmentLock: body.apartmentLock === "soft" || body.apartmentLock === "hard" ? body.apartmentLock : "none",
    createdAt: now,
    updatedAt: now,
  };
  const res = await db.collection(COLLECTION_STATES).insertOne(doc);
  const row = toStateRow({ _id: res.insertedId, ...doc });
  return { state: row };
};

export const createWorkflowTransition = async (body: {
  workflowId: string;
  fromStateId: string;
  toStateId: string;
}): Promise<{ transition: WorkflowTransitionRow }> => {
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    workflowId: body.workflowId,
    fromStateId: body.fromStateId,
    toStateId: body.toStateId,
    createdAt: now,
  };
  const res = await db.collection(COLLECTION_TRANSITIONS).insertOne(doc);
  const row = toTransitionRow({ _id: res.insertedId, ...doc });
  return { transition: row };
};

// ─── Update / delete (sicurezza: blocco se in uso) ───────────────────────────

/** Richieste con stato corrente = stateId o lock attivi su quello stato workflow. */
export async function countWorkflowStateRuntimeReferences(stateId: string): Promise<{ requests: number; locks: number }> {
  if (!stateId || !ObjectId.isValid(stateId)) return { requests: 0, locks: 0 };
  const db = getDb();
  const [requests, locks] = await Promise.all([
    db.collection(COLLECTION_REQUESTS).countDocuments({ currentStateId: stateId }),
    db.collection(COLLECTION_APARTMENT_LOCKS).countDocuments({ workflowStateId: stateId }),
  ]);
  return { requests, locks: typeof locks === "number" ? locks : 0 };
}

export async function countWorkflowTransitionsUsingState(stateId: string): Promise<number> {
  if (!stateId || !ObjectId.isValid(stateId)) return 0;
  const db = getDb();
  return db.collection(COLLECTION_TRANSITIONS).countDocuments({
    $or: [{ fromStateId: stateId }, { toStateId: stateId }],
  });
}

export type UpdateWorkflowStateBody = Partial<{
  code: string;
  label: string;
  order: number;
  terminal: boolean;
  reversible: boolean;
  apartmentLock: ApartmentLockType;
}>;

/**
 * Aggiorna uno stato workflow. Cambio `code` vietato se lo stato è referenziato da richieste o lock.
 */
export const updateWorkflowState = async (
  stateId: string,
  body: UpdateWorkflowStateBody
): Promise<{ state: WorkflowStateRow }> => {
  if (!stateId || !ObjectId.isValid(stateId)) {
    throw new HttpError("Stato workflow non trovato", 404);
  }
  const db = getDb();
  const statesColl = db.collection(COLLECTION_STATES);
  const existing = await statesColl.findOne({ _id: new ObjectId(stateId) });
  if (!existing) {
    throw new HttpError("Stato workflow non trovato", 404);
  }

  const workflowId = typeof existing.workflowId === "string" ? existing.workflowId : "";
  const prevCode = typeof existing.code === "string" ? existing.code : "";

  const newCodeTrimmed = body.code !== undefined ? body.code.trim() : undefined;
  if (newCodeTrimmed !== undefined && newCodeTrimmed !== prevCode) {
    const refs = await countWorkflowStateRuntimeReferences(stateId);
    if (refs.requests > 0 || refs.locks > 0) {
      throw new HttpError(
        "Impossibile modificare il code: lo stato è in uso da trattative o da lock appartamento. Rimuovi i riferimenti o crea una nuova versione del workflow.",
        409,
        "WorkflowStateInUse"
      );
    }
    const dup = await statesColl.findOne({
      workflowId,
      code: newCodeTrimmed,
      _id: { $ne: new ObjectId(stateId) },
    });
    if (dup) {
      throw new HttpError("Esiste già uno stato con questo code nello stesso workflow", 409, "WorkflowStateCodeConflict");
    }
  }

  const now = new Date().toISOString();
  const $set: Record<string, unknown> = { updatedAt: now };
  if (newCodeTrimmed !== undefined) $set.code = newCodeTrimmed;
  if (body.label !== undefined) {
    $set.label = body.label.trim() || (typeof existing.code === "string" ? existing.code : "");
  }
  if (body.order !== undefined) $set.order = body.order;
  if (body.terminal !== undefined) $set.terminal = Boolean(body.terminal);
  if (body.reversible !== undefined) $set.reversible = Boolean(body.reversible);
  if (body.apartmentLock !== undefined) {
    $set.apartmentLock =
      body.apartmentLock === "soft" || body.apartmentLock === "hard" ? body.apartmentLock : "none";
  }

  if (Object.keys($set).length <= 1) {
    return { state: toStateRow(existing as Parameters<typeof toStateRow>[0]) };
  }

  await statesColl.updateOne({ _id: new ObjectId(stateId) }, { $set });
  const updated = await statesColl.findOne({ _id: new ObjectId(stateId) });
  if (!updated) throw new HttpError("Stato workflow non trovato", 404);
  return { state: toStateRow(updated as Parameters<typeof toStateRow>[0]) };
};

/**
 * Elimina uno stato solo se non referenziato e senza transizioni in/out.
 */
export const deleteWorkflowState = async (stateId: string): Promise<{ deleted: true }> => {
  if (!stateId || !ObjectId.isValid(stateId)) {
    throw new HttpError("Stato workflow non trovato", 404);
  }
  const refs = await countWorkflowStateRuntimeReferences(stateId);
  if (refs.requests > 0 || refs.locks > 0) {
    throw new HttpError(
      "Impossibile eliminare lo stato: in uso da trattative o lock appartamento.",
      409,
      "WorkflowStateInUse"
    );
  }
  const edgeCount = await countWorkflowTransitionsUsingState(stateId);
  if (edgeCount > 0) {
    throw new HttpError(
      "Impossibile eliminare lo stato: rimuovi prima le transizioni collegate.",
      409,
      "WorkflowStateHasTransitions"
    );
  }
  const db = getDb();
  const res = await db.collection(COLLECTION_STATES).deleteOne({ _id: new ObjectId(stateId) });
  if (res.deletedCount === 0) {
    throw new HttpError("Stato workflow non trovato", 404);
  }
  return { deleted: true };
};

/**
 * Elimina una transizione di configurazione (nessun riferimento runtime per ID).
 */
export const deleteWorkflowTransition = async (transitionId: string): Promise<{ deleted: true }> => {
  if (!transitionId || !ObjectId.isValid(transitionId)) {
    throw new HttpError("Transizione non trovata", 404);
  }
  const db = getDb();
  const res = await db.collection(COLLECTION_TRANSITIONS).deleteOne({ _id: new ObjectId(transitionId) });
  if (res.deletedCount === 0) {
    throw new HttpError("Transizione non trovata", 404);
  }
  return { deleted: true };
};

/**
 * Elimina un intero workflow con tutti gli stati/transizioni di configurazione.
 * Bloccato se workflow in uso da richieste, lock o override progetto.
 */
export const deleteWorkflow = async (workflowId: string): Promise<{ deleted: true }> => {
  if (!workflowId || !ObjectId.isValid(workflowId)) {
    throw new HttpError("Workflow non trovato", 404);
  }
  const db = getDb();
  const wfObjectId = new ObjectId(workflowId);
  const workflowsColl = db.collection(COLLECTION_WORKFLOWS);
  const statesColl = db.collection(COLLECTION_STATES);
  const transitionsColl = db.collection(COLLECTION_TRANSITIONS);

  const existing = await workflowsColl.findOne({ _id: wfObjectId });
  if (!existing) {
    throw new HttpError("Workflow non trovato", 404);
  }

  const [requestsCount, projectOverrideCount, stateDocs] = await Promise.all([
    db.collection(COLLECTION_REQUESTS).countDocuments({ workflowId }),
    db.collection(COLLECTION_PROJECT_WORKFLOW_SETTINGS).countDocuments({ workflowId }),
    statesColl.find({ workflowId }, { projection: { _id: 1 } }).toArray(),
  ]);

  const stateIds = stateDocs
    .map((s) => (s._id instanceof ObjectId ? s._id.toHexString() : String(s._id)))
    .filter((id) => ObjectId.isValid(id));

  const locksCount =
    stateIds.length > 0
      ? await db.collection(COLLECTION_APARTMENT_LOCKS).countDocuments({ workflowStateId: { $in: stateIds } })
      : 0;

  if (requestsCount > 0 || locksCount > 0 || projectOverrideCount > 0) {
    throw new HttpError(
      "Impossibile eliminare workflow: è referenziato da trattative, lock appartamenti o override progetto.",
      409,
      "WorkflowInUse"
    );
  }

  await Promise.all([
    transitionsColl.deleteMany({ workflowId }),
    statesColl.deleteMany({ workflowId }),
  ]);
  const res = await workflowsColl.deleteOne({ _id: wfObjectId });
  if (res.deletedCount === 0) {
    throw new HttpError("Workflow non trovato", 404);
  }
  return { deleted: true };
};
