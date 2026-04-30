import { deleteJson, getJson, patchJson, postJson } from "../http";
import type {
  HandoverRow,
  ListQuery,
  PaginatedResponse,
  UnitIssuePriority,
  UnitIssueStatus,
  UnitIssueRow,
} from "../../types/domain";

export type UnitIssueCreateInput = {
  workspaceId: string;
  projectId: string;
  apartmentId: string;
  title: string;
  description?: string;
  status?: UnitIssueStatus;
  priority?: UnitIssuePriority;
  assigneeUserId?: string;
  contractorNote?: string;
  photoUrls?: string[];
  clientId?: string;
  requestId?: string;
};

export type UnitIssuePatchInput = {
  workspaceId: string;
  projectId: string;
  title?: string;
  description?: string;
  status?: UnitIssueStatus;
  priority?: UnitIssuePriority;
  assigneeUserId?: string | null;
  contractorNote?: string | null;
  photoUrls?: string[];
  clientId?: string | null;
  requestId?: string | null;
};

export const postDeliveryApi = {
  queryUnitIssues: (query: ListQuery) =>
    postJson<PaginatedResponse<UnitIssueRow>>("/unit-issues/query", query),

  createUnitIssue: (body: UnitIssueCreateInput) =>
    postJson<{ issue: UnitIssueRow }>("/unit-issues", body),

  getUnitIssueById: (id: string, workspaceId: string) =>
    getJson<{ issue: UnitIssueRow }>(`/unit-issues/${id}?workspaceId=${encodeURIComponent(workspaceId)}`),

  patchUnitIssue: (id: string, body: UnitIssuePatchInput) =>
    patchJson<{ issue: UnitIssueRow }>(`/unit-issues/${id}`, body),

  deleteUnitIssue: (id: string, workspaceId: string, projectId: string) =>
    deleteJson<{ deleted: boolean }>(
      `/unit-issues/${id}?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`
    ),

  queryHandovers: (query: ListQuery) =>
    postJson<PaginatedResponse<HandoverRow>>("/handovers/query", query),

  getOrCreateHandover: (body: { workspaceId: string; projectId: string; apartmentId: string; requestId?: string }) =>
    postJson<{ handover: HandoverRow; created: boolean }>("/handovers", body),

  getHandoverForApartment: (workspaceId: string, projectId: string, apartmentId: string) =>
    getJson<{ handover: HandoverRow | null }>(
      `/handovers/for-apartment?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}&apartmentId=${encodeURIComponent(apartmentId)}`
    ),

  getHandoverById: (id: string, workspaceId: string) =>
    getJson<{ handover: HandoverRow }>(`/handovers/${id}?workspaceId=${encodeURIComponent(workspaceId)}`),

  patchHandover: (
    id: string,
    body: {
      workspaceId: string;
      projectId: string;
      sessionStatus?: HandoverRow["sessionStatus"];
      checklist?: Array<{ itemId: string; done?: boolean; photoUrls?: string[]; notes?: string | null }>;
    }
  ) => patchJson<{ handover: HandoverRow }>(`/handovers/${id}`, body),
};
