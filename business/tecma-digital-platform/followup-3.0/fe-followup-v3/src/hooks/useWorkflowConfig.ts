import { useEffect, useMemo, useState } from "react";
import { followupApi } from "../api/followupApi";
import {
  REQUEST_STATUS_LABEL,
  REQUEST_ALLOWED_TRANSITIONS,
  REQUEST_STATUS_ORDER,
} from "../constants/requestStatus";
import type { RequestStatus } from "../types/domain";
import type { WorkflowWithDetail } from "../types/domain";

export interface WorkflowConfigResult {
  /** Mappa code -> label (da workflow o fallback). */
  statusLabelByCode: Record<string, string>;
  /** Per ogni stato, prossimi stati consentiti (da workflow o fallback). */
  allowedNextStatuses: (currentStatus: RequestStatus) => RequestStatus[];
  /** Ordine stati per roadmap (da workflow o fallback). */
  statusOrder: RequestStatus[];
  /** Dettaglio workflow se caricato, altrimenti null. */
  workflowDetail: WorkflowWithDetail | null;
  loading: boolean;
  error: unknown;
}

function buildFromWorkflow(detail: WorkflowWithDetail): {
  statusLabelByCode: Record<string, string>;
  allowedNextStatuses: (currentStatus: RequestStatus) => RequestStatus[];
  statusOrder: RequestStatus[];
} {
  const states = detail.states;
  const transitions = detail.transitions;
  const statusLabelByCode: Record<string, string> = {};
  const stateIdToCode: Record<string, string> = {};
  for (const s of states) {
    statusLabelByCode[s.code] = s.label;
    stateIdToCode[s._id] = s.code;
  }
  const fromStateIdToToCodes: Record<string, string[]> = {};
  for (const t of transitions) {
    const toCode = stateIdToCode[t.toStateId];
    if (!toCode) continue;
    if (!fromStateIdToToCodes[t.fromStateId]) fromStateIdToToCodes[t.fromStateId] = [];
    fromStateIdToToCodes[t.fromStateId].push(toCode);
  }
  const codeToStateId: Record<string, string> = {};
  for (const s of states) {
    codeToStateId[s.code] = s._id;
  }
  const allowedNextStatuses = (currentStatus: RequestStatus): RequestStatus[] => {
    const fromId = codeToStateId[currentStatus];
    if (!fromId) return [];
    const codes = fromStateIdToToCodes[fromId] ?? [];
    return codes as RequestStatus[];
  };
  const statusOrder = [...states]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.code as RequestStatus);
  return { statusLabelByCode, allowedNextStatuses, statusOrder };
}

/**
 * Carica la config workflow per workspace + tipo e espone label, transizioni e ordine stati.
 * Se non c'è workflow configurato, usa le costanti di fallback.
 */
export function useWorkflowConfig(
  workspaceId: string | undefined,
  type: "rent" | "sell"
): WorkflowConfigResult {
  const [workflowsData, setWorkflowsData] = useState<{ workflows: { _id: string; type: string }[] } | null>(null);
  const [detail, setDetail] = useState<WorkflowWithDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!workspaceId) {
      setWorkflowsData(null);
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    followupApi
      .listWorkflowsByWorkspace(workspaceId)
      .then((res) => {
        if (cancelled) return;
        setWorkflowsData(res);
        const w = res.workflows?.find((x) => x.type === type);
        if (!w) {
          setDetail(null);
          setLoading(false);
          return;
        }
        return followupApi.getWorkflowWithStatesAndTransitions(w._id);
      })
      .then((d) => {
        if (cancelled || d === undefined) return;
        setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, type]);

  return useMemo((): WorkflowConfigResult => {
    if (detail?.workflow && detail?.states?.length) {
      const built = buildFromWorkflow(detail);
      return {
        ...built,
        workflowDetail: detail,
        loading,
        error,
      };
    }
    return {
      statusLabelByCode: REQUEST_STATUS_LABEL as Record<string, string>,
      allowedNextStatuses: (current: RequestStatus) => REQUEST_ALLOWED_TRANSITIONS[current] ?? [],
      statusOrder: REQUEST_STATUS_ORDER,
      workflowDetail: null,
      loading,
      error,
    };
  }, [detail, loading, error]);
}
