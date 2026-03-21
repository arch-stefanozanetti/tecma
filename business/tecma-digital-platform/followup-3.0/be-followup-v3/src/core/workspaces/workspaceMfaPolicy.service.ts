/**
 * Policy MFA per workspace (flag mfaRequired su tz_workspaces) e variabile globale AUTH_MFA_REQUIRED_GLOBALLY.
 */
import { ObjectId } from "mongodb";
import { ENV } from "../../config/env.js";
import { getDb } from "../../config/db.js";
import { listWorkspaceMembershipsForUser } from "./workspace-users.service.js";

const WS = "tz_workspaces";

/**
 * Se true, l'utente deve avere MFA attivo (tz_user_security) prima di ricevere token dopo login password.
 */
export async function emailRequiresMfaByWorkspacePolicy(emailLower: string): Promise<boolean> {
  const memberships = await listWorkspaceMembershipsForUser(emailLower);
  if (memberships.length === 0) return false;
  if (ENV.AUTH_MFA_REQUIRED_GLOBALLY) return true;

  const db = getDb();
  for (const m of memberships) {
    if (!ObjectId.isValid(m.workspaceId)) continue;
    const doc = await db
      .collection(WS)
      .findOne({ _id: new ObjectId(m.workspaceId) }, { projection: { mfaRequired: 1 } });
    if (doc && (doc as { mfaRequired?: boolean }).mfaRequired === true) {
      return true;
    }
  }
  return false;
}
