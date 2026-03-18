import type { CreateIndexesOptions } from "mongodb";
import { getDb } from "./db.js";
import { logger } from "../observability/logger.js";

type IndexSpec = {
  collection: string;
  key: Record<string, 1 | -1>;
  options?: CreateIndexesOptions;
};

const INDEX_SPECS: IndexSpec[] = [
  { collection: "tz_users", key: { email: 1 }, options: { unique: true, name: "uq_tz_users_email" } },
  { collection: "tz_authSessions", key: { userId: 1, createdAt: -1 }, options: { name: "idx_tz_authSessions_userId_createdAt" } },
  { collection: "tz_authEvents", key: { userId: 1, createdAt: -1 }, options: { name: "idx_tz_authEvents_userId_createdAt" } },
  { collection: "tz_inviteTokens", key: { token: 1 }, options: { unique: true, name: "uq_tz_inviteTokens_token" } },
  { collection: "tz_passwordResetTokens", key: { token: 1 }, options: { unique: true, name: "uq_tz_passwordResetTokens_token" } },

  { collection: "tz_clients", key: { workspaceId: 1, projectId: 1 }, options: { name: "idx_tz_clients_workspace_project" } },
  { collection: "tz_clients", key: { workspaceId: 1, projectId: 1, updatedAt: -1 }, options: { name: "idx_tz_clients_workspace_project_updatedAt" } },

  { collection: "tz_apartments", key: { workspaceId: 1, projectId: 1 }, options: { name: "idx_tz_apartments_workspace_project" } },
  { collection: "tz_apartments", key: { workspaceId: 1, projectId: 1, updatedAt: -1 }, options: { name: "idx_tz_apartments_workspace_project_updatedAt" } },

  { collection: "tz_requests", key: { workspaceId: 1, projectId: 1, updatedAt: -1 }, options: { name: "idx_tz_requests_workspace_project_updatedAt" } },
  { collection: "tz_requests", key: { workspaceId: 1, projectId: 1, currentStateId: 1 }, options: { name: "idx_tz_requests_workspace_project_state" } },
  { collection: "tz_requests", key: { clientId: 1 }, options: { name: "idx_tz_requests_clientId" } },
  { collection: "tz_requests", key: { apartmentId: 1 }, options: { name: "idx_tz_requests_apartmentId" } },
  { collection: "tz_request_transitions", key: { requestId: 1, createdAt: -1 }, options: { name: "idx_tz_request_transitions_requestId_createdAt" } },
  { collection: "tz_request_actions", key: { requestId: 1, createdAt: -1 }, options: { name: "idx_tz_request_actions_requestId_createdAt" } },

  { collection: "calendar_events", key: { workspaceId: 1, projectId: 1, startsAt: 1 }, options: { name: "idx_calendar_events_workspace_project_startsAt" } },

  { collection: "tz_workflow_configs", key: { workspaceId: 1, projectId: 1, flowType: 1 }, options: { name: "idx_tz_workflow_configs_scope_flowType" } },
  { collection: "tz_workflows", key: { workspaceId: 1, flowType: 1 }, options: { name: "idx_tz_workflows_workspace_flowType" } },
  { collection: "tz_workflow_states", key: { workflowId: 1, id: 1 }, options: { unique: true, name: "uq_tz_workflow_states_workflow_stateId" } },
  { collection: "tz_workflow_transitions", key: { workflowId: 1, fromStateId: 1, toStateId: 1 }, options: { unique: true, name: "uq_tz_workflow_transitions_unique_path" } },
  { collection: "tz_apartment_locks", key: { apartmentId: 1 }, options: { name: "idx_tz_apartment_locks_apartmentId" } },

  { collection: "tz_workspaces", key: { slug: 1 }, options: { unique: true, name: "uq_tz_workspaces_slug" } },
  { collection: "tz_workspace_projects", key: { workspaceId: 1, projectId: 1 }, options: { unique: true, name: "uq_tz_workspace_projects_workspace_project" } },
  { collection: "tz_user_workspaces", key: { workspaceId: 1, userId: 1 }, options: { unique: true, name: "uq_tz_user_workspaces_workspace_user" } },
  { collection: "tz_workspace_user_projects", key: { workspaceId: 1, userId: 1, projectId: 1 }, options: { unique: true, name: "uq_tz_workspace_user_projects_scope" } },
  { collection: "tz_entity_assignments", key: { workspaceId: 1, entityType: 1, entityId: 1, userId: 1 }, options: { unique: true, name: "uq_tz_entity_assignments_scope_entity_user" } },
  { collection: "tz_entity_assignments", key: { workspaceId: 1, userId: 1 }, options: { name: "idx_tz_entity_assignments_workspace_user" } },
];

export async function ensureIndexes(): Promise<void> {
  const db = getDb();
  let ok = 0;
  let failed = 0;
  for (const spec of INDEX_SPECS) {
    try {
      await db.collection(spec.collection).createIndex(spec.key, spec.options);
      ok += 1;
    } catch (err) {
      failed += 1;
      logger.error({ err, collection: spec.collection, key: spec.key, options: spec.options }, "MongoDB index ensure failed");
    }
  }
  logger.info({ ensuredIndexes: ok, failedIndexes: failed, totalIndexes: INDEX_SPECS.length }, "MongoDB indexes ensured");
}
