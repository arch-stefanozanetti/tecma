import { HttpError } from "../../types/http.js";
import { getWorkflowForWorkspaceAndType } from "./workflow-engine.service.js";

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

/** Legacy endpoint adapter: reads runtime workflow engine (strict, no fallback). */
export const getWorkflowConfig = async (
  workspaceId: string,
  projectId: string,
  flowType: "rent" | "sell"
): Promise<WorkflowConfig> => {
  const detail = await getWorkflowForWorkspaceAndType(workspaceId, flowType, projectId);
  if (!detail) {
    throw new HttpError(
      `Workflow non configurato per workspace "${workspaceId}", progetto "${projectId}" e tipo "${flowType}"`,
      400,
      "WorkflowNotConfigured"
    );
  }
  const stateById = new Map(detail.states.map((s) => [s._id, s.code]));
  const states: WorkflowState[] = detail.states.map((s) => ({
    id: s.code,
    label: s.label,
    isTerminal: s.terminal,
    isRequestEditable: !s.terminal,
  }));
  const transitions: WorkflowTransition[] = detail.transitions
    .map((t) => {
      const fromState = stateById.get(t.fromStateId);
      const toState = stateById.get(t.toStateId);
      if (!fromState || !toState) return null;
      return {
        fromState,
        toState,
        event: `${fromState}_to_${toState}`,
      } satisfies WorkflowTransition;
    })
    .filter((x): x is WorkflowTransition => x !== null);
  return { flowType, states, transitions, version: 1 };
};
