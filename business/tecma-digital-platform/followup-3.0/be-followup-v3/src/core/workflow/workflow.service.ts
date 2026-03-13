import { getDb } from "../../config/db.js";

const TZ_WORKFLOW_COLLECTION = "tz_workflow_configs";
const AUTOMATA_COLLECTION = "automata_configurations";

export interface WorkflowState {
  id: string;
  label?: string;
  isTerminal?: boolean;
  isRequestEditable?: boolean;
  notify?: boolean;
}

export interface WorkflowTransition {
  fromState: string;
  toState: string;
  event: string;
}

export interface WorkflowConfig {
  flowType: "rent" | "sell" | "generic";
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  version?: number;
}

/**
 * Get workflow config for a given flow type.
 * Tries tz_workflow_configs (primary DB) first, then falls back to status-automata.automata_configurations.
 */
export const getWorkflowConfig = async (
  workspaceId: string,
  projectId: string,
  flowType: "rent" | "sell"
): Promise<WorkflowConfig> => {
  const db = getDb();
  const tzColl = db.collection(TZ_WORKFLOW_COLLECTION);
  const tzDoc = await tzColl.findOne({
    workspaceId,
    projectId,
    flowType,
  });

  if (tzDoc && tzDoc.states && Array.isArray(tzDoc.states)) {
    return {
      flowType: tzDoc.flowType ?? flowType,
      states: tzDoc.states,
      transitions: Array.isArray(tzDoc.transitions) ? tzDoc.transitions : [],
      version: typeof tzDoc.version === "number" ? tzDoc.version : undefined,
    };
  }

  const area = flowType === "rent" ? "RENT" : "SELL";
  const automataDb = getDb();
  const automataColl = automataDb.collection(AUTOMATA_COLLECTION);
  const automataDoc = await automataColl.findOne({
    flow: "REQUEST",
    area,
  });

  if (!automataDoc || !automataDoc.automata) {
    return getDefaultWorkflowConfig(flowType);
  }

  const automata = automataDoc.automata as Record<
    string,
    {
      nextStates?: Record<string, string>;
      isRequestEditable?: boolean;
      notify?: boolean;
      children?: string[];
    }
  >;

  const states: WorkflowState[] = [];
  const transitions: WorkflowTransition[] = [];

  for (const [stateId, config] of Object.entries(automata)) {
    const nextStates = config?.nextStates ?? {};
    const hasNext = Object.keys(nextStates).length > 0;
    states.push({
      id: stateId,
      isTerminal: !hasNext,
      isRequestEditable: config?.isRequestEditable,
      notify: config?.notify,
    });
    for (const [event, toState] of Object.entries(nextStates)) {
      if (toState) {
        transitions.push({ fromState: stateId, toState, event });
      }
    }
  }

  return {
    flowType,
    states,
    transitions,
    version: typeof automataDoc.version === "number" ? automataDoc.version : undefined,
  };
};

function getDefaultWorkflowConfig(flowType: "rent" | "sell"): WorkflowConfig {
  const states: WorkflowState[] = [
    { id: "new", label: "Nuova", isRequestEditable: true },
    { id: "contacted", label: "Contattato", isRequestEditable: true },
    { id: "viewing", label: "Visita", isRequestEditable: true },
    { id: "offer", label: "Offerta", isRequestEditable: true },
    { id: "won", label: "Vinto", isTerminal: true },
    { id: "lost", label: "Perso", isTerminal: true },
  ];
  const transitions: WorkflowTransition[] = [
    { fromState: "new", toState: "contacted", event: "contact" },
    { fromState: "new", toState: "viewing", event: "view" },
    { fromState: "new", toState: "lost", event: "lose" },
    { fromState: "contacted", toState: "viewing", event: "view" },
    { fromState: "contacted", toState: "offer", event: "offer" },
    { fromState: "contacted", toState: "lost", event: "lose" },
    { fromState: "viewing", toState: "offer", event: "offer" },
    { fromState: "viewing", toState: "contacted", event: "contact" },
    { fromState: "viewing", toState: "lost", event: "lose" },
    { fromState: "offer", toState: "won", event: "win" },
    { fromState: "offer", toState: "lost", event: "lose" },
    { fromState: "offer", toState: "viewing", event: "view" },
  ];
  return { flowType, states, transitions, version: 1 };
}
