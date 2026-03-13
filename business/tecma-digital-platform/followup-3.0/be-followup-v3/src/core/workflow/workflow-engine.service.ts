/**
 * Workflow engine: modello normalizzato Workflow / WorkflowState / WorkflowTransition.
 * Usato per stati e transizioni configurabili per workspace (piano FU3 workflow/state machine).
 * Fase 1: API lettura + validazione transizioni da config; Request continua a usare status string.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";

const COLLECTION_WORKFLOWS = "tz_workflows";
const COLLECTION_STATES = "tz_workflow_states";
const COLLECTION_TRANSITIONS = "tz_workflow_transitions";

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
 * Usa il primo workflow del tipo richiesto per quel workspace; se nessuno, null (il chiamante userà ALLOWED_TRANSITIONS).
 */
export const getWorkflowForWorkspaceAndType = async (
  workspaceId: string,
  type: "rent" | "sell"
): Promise<WorkflowWithDetail | null> => {
  if (!workspaceId) return null;
  const db = getDb();
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
 * Se non c'è config per il workspace, restituisce null (il chiamante userà ALLOWED_TRANSITIONS).
 */
export const isTransitionAllowedForWorkspace = async (
  workspaceId: string,
  requestType: "rent" | "sell",
  fromStatus: string,
  toStatus: string
): Promise<boolean | null> => {
  const detail = await getWorkflowForWorkspaceAndType(workspaceId, requestType);
  if (!detail) return null;
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
