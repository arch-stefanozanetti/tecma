import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import type { MembershipRole } from "../../types/models.js";
import { deleteInviteTokensForUserId } from "../auth/inviteToken.service.js";
import { inviteUser, deleteUserById, updateUserById } from "../users/users-mutations.service.js";
import { addWorkspaceUser, removeWorkspaceUser } from "./workspace-users.service.js";
import { addWorkspaceUserProject } from "./workspace-user-projects.service.js";

const WORKSPACE_PROJECTS = "tz_workspace_projects";

export type CreateWorkspaceInvitationParams = {
  workspaceId: string;
  email: string;
  role: MembershipRole;
  projectIds: string[];
  roleLabel?: string;
  appPublicBaseUrl: string;
  permissionsOverride?: string[];
};

export type CreateWorkspaceInvitationResult = {
  userId: string;
  email: string;
  workspaceId: string;
  role: MembershipRole;
  projectIds: string[];
};

async function assertProjectsInWorkspace(workspaceId: string, projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) {
    throw new HttpError("Seleziona almeno un progetto", 400);
  }
  const db = getDb();
  const coll = db.collection(WORKSPACE_PROJECTS);
  for (const projectId of projectIds) {
    const link = await coll.findOne({ workspaceId, projectId });
    if (!link) {
      throw new HttpError(`Il progetto ${projectId} non è associato a questo workspace`, 400);
    }
  }
}

async function resolveProjectName(workspaceId: string, projectId: string): Promise<string> {
  const db = getDb();
  const link = await db.collection(WORKSPACE_PROJECTS).findOne({ workspaceId, projectId });
  if (link && typeof link === "object") {
    const row = link as { displayName?: unknown; name?: unknown };
    if (typeof row.displayName === "string" && row.displayName.trim()) return row.displayName.trim();
    if (typeof row.name === "string" && row.name.trim()) return row.name.trim();
  }
  return projectId;
}

/**
 * Invito workspace unificato: crea utente invited + email, membership workspace e grant progetti.
 * Rollback su fallimento post-invio email.
 */
export async function createWorkspaceInvitation(
  params: CreateWorkspaceInvitationParams
): Promise<CreateWorkspaceInvitationResult> {
  const workspaceId = params.workspaceId.trim();
  const email = params.email.trim().toLowerCase();
  const projectIds = [...new Set(params.projectIds.map((p) => p.trim()).filter(Boolean))];

  if (!workspaceId || !email) {
    throw new HttpError("workspaceId ed email obbligatori", 400);
  }

  await assertProjectsInWorkspace(workspaceId, projectIds);

  const primaryProjectId = projectIds[0]!;
  const projectName = await resolveProjectName(workspaceId, primaryProjectId);
  const roleLabel = params.roleLabel?.trim() || params.role;

  let userId: string | null = null;
  let membershipAdded = false;

  try {
    const invite = await inviteUser({
      email,
      projectId: primaryProjectId,
      projectName,
      appPublicBaseUrl: params.appPublicBaseUrl,
      roleLabel,
    });
    userId = invite.userId;

    await addWorkspaceUser(workspaceId, {
      userId: email,
      role: params.role,
    });
    membershipAdded = true;

    for (const projectId of projectIds) {
      await addWorkspaceUserProject(workspaceId, email, projectId);
    }

    if (params.permissionsOverride !== undefined && params.permissionsOverride.length > 0) {
      await updateUserById(userId, { permissions_override: params.permissionsOverride });
    }

    return {
      userId,
      email,
      workspaceId,
      role: params.role,
      projectIds,
    };
  } catch (err) {
    if (userId) {
      if (membershipAdded) {
        try {
          await removeWorkspaceUser(workspaceId, email);
        } catch {
          /* best effort rollback */
        }
      }
      await deleteInviteTokensForUserId(userId);
      await deleteUserById(userId);
    }
    throw err;
  }
}
