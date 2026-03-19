import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { ENV } from "../../config/env.js";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { logAuthEvent } from "../auth/authAudit.service.js";
import {
  consumeInviteToken,
  createInviteToken,
  deleteInviteTokensForUserId
} from "../auth/inviteToken.service.js";
import { isInviteEmailDeliverable, sendInviteEmail } from "../email/email.service.js";
import { signAccessToken, type AccessTokenPayload } from "../auth/token.service.js";
import { createSession } from "../auth/refreshSession.service.js";
import {
  USER_COLLECTION_CANDIDATES,
  buildAccessPayloadFromUserDoc,
  toAuthSessionUser
} from "../auth/userAccessPayload.js";

const COLLECTION_USERS = "tz_users";

export type UserStatus = "invited" | "active" | "disabled";

export interface TzUserDoc {
  _id: ObjectId;
  email?: string;
  password?: string;
  role?: string;
  isDisabled?: boolean;
  status?: UserStatus;
  permissions_override?: string[];
  email_verified?: boolean;
  project_ids?: string[];
}

function usersColl() {
  return getDb().collection<TzUserDoc>(COLLECTION_USERS);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<TzUserDoc | null> {
  const e = normalizeEmail(email);
  return usersColl().findOne({
    email: { $regex: `^${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });
}

export async function findUserById(userId: string): Promise<TzUserDoc | null> {
  if (!ObjectId.isValid(userId)) return null;
  return usersColl().findOne({ _id: new ObjectId(userId) });
}

function effectiveStatus(doc: TzUserDoc): UserStatus {
  if (doc.isDisabled) return "disabled";
  if (doc.status === "invited") return "invited";
  return doc.status === "disabled" ? "disabled" : "active";
}

export function isInvitedWithoutPassword(doc: TzUserDoc): boolean {
  const st = effectiveStatus(doc);
  return st === "invited" || (!doc.password && st !== "disabled");
}

export async function buildAccessPayloadForUser(doc: TzUserDoc): Promise<AccessTokenPayload> {
  return buildAccessPayloadFromUserDoc(doc, normalizeEmail(doc.email || ""));
}

async function emailExistsInAnyUserCollection(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  const regex = new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const db = getDb();
  for (const name of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) continue;
    const hit = await db.collection(name).findOne({ email: { $regex: regex } });
    if (hit) return true;
  }
  return false;
}

const MOCK_INVITE_OK = () => process.env.INVITE_ALLOW_MOCK_EMAIL === "true";

export async function inviteUser(params: {
  email: string;
  projectId: string;
  projectName: string;
  /** URL base del FE per il link nell'email (es. da Origin) */
  appPublicBaseUrl: string;
  /** Label ruolo per l'email (es. "Vendor", "Admin"); default "Membro" */
  roleLabel?: string;
}): Promise<{ userId: string }> {
  const email = normalizeEmail(params.email);
  if (await emailExistsInAnyUserCollection(email)) {
    throw new HttpError("Utente già registrato con questa email", 409);
  }
  if (!isInviteEmailDeliverable() && !MOCK_INVITE_OK()) {
    throw new HttpError(
      "Invio email non configurato: imposta EMAIL_TRANSPORT=smtp, SES_SMTP_USER, SES_SMTP_PASS " +
        "(credenziali AWS SES) e EMAIL_FROM con dominio verificato in SES. " +
        "In sviluppo senza SES: INVITE_ALLOW_MOCK_EMAIL=true e EMAIL_TRANSPORT=mock (nessuna mail reale).",
      503
    );
  }
  const roleLabel = params.roleLabel ?? "Membro";
  const _id = new ObjectId();
  await usersColl().insertOne({
    _id,
    email,
    status: "invited",
    project_ids: [params.projectId],
    email_verified: false
  });
  const rawToken = await createInviteToken({
    email,
    role: roleLabel,
    projectId: params.projectId,
    userId: _id.toHexString()
  });
  try {
    await sendInviteEmail({
      to: email,
      token: rawToken,
      projectName: params.projectName,
      roleLabel,
      appPublicBaseUrl: params.appPublicBaseUrl
    });
  } catch (err) {
    await deleteInviteTokensForUserId(_id.toHexString());
    await usersColl().deleteOne({ _id });
    const detail = err instanceof Error ? err.message : String(err);
    throw new HttpError(
      `Impossibile inviare l'email di invito. L'utente non è stato creato. Dettaglio: ${detail}`,
      502
    );
  }
  return { userId: _id.toHexString() };
}

export async function setPasswordFromInvite(
  params: {
    token: string;
    password: string;
  },
  meta: { ipAddress?: string | null; userAgent?: string | null } = {}
): Promise<{ accessToken: string; refreshToken: string; expiresIn: string; user: object }> {
  const invite = await consumeInviteToken(params.token);
  if (!invite) {
    throw new HttpError("Token non valido o scaduto", 400);
  }
  const doc = await findUserById(invite.userId);
  if (!doc) {
    throw new HttpError("Utente non trovato", 400);
  }
  if (params.password.length < 8) {
    throw new HttpError("Password minimo 8 caratteri", 400);
  }
  const hash = await bcrypt.hash(params.password, 12);
  await usersColl().updateOne(
    { _id: doc._id },
    { $set: { password: hash, status: "active" as UserStatus, email_verified: true } }
  );
  const updated = { ...doc, password: hash, status: "active" as UserStatus };
  const payload = await buildAccessPayloadForUser(updated as TzUserDoc);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createSession(payload.sub, payload.email);
  await logAuthEvent("invite_accepted", {
    userId: payload.sub,
    email: payload.email,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    success: true
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN,
    user: toAuthSessionUser(payload)
  };
}

export async function updateUserById(
  userId: string,
  patch: Partial<{ role: string; status: UserStatus; permissions_override: string[]; isDisabled: boolean }>
): Promise<TzUserDoc | null> {
  if (!ObjectId.isValid(userId)) return null;
  const $set: Record<string, unknown> = {};
  if (patch.role !== undefined) $set.role = patch.role;
  if (patch.status !== undefined) $set.status = patch.status;
  if (patch.permissions_override !== undefined) $set.permissions_override = patch.permissions_override;
  if (patch.isDisabled !== undefined) {
    $set.isDisabled = patch.isDisabled;
    if (patch.isDisabled) $set.status = "disabled";
  }
  if (Object.keys($set).length === 0) return findUserById(userId);
  await usersColl().updateOne({ _id: new ObjectId(userId) }, { $set });
  return findUserById(userId);
}

export async function deleteUserById(userId: string): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false;
  const r = await usersColl().deleteOne({ _id: new ObjectId(userId) });
  return (r.deletedCount ?? 0) > 0;
}

export async function listUsersWithId(): Promise<
  Array<{
    id: string;
    email: string;
    role: string | null;
    status: UserStatus;
    projectIds: string[];
    isAdmin: boolean;
  }>
> {
  const docs = await usersColl()
    .find({})
    .project({ email: 1, role: 1, status: 1, project_ids: 1, isDisabled: 1 })
    .toArray();
  return docs.map((u) => {
    const email = normalizeEmail(u.email || "");
    const role = typeof u.role === "string" ? u.role : null;
    const st = effectiveStatus(u as TzUserDoc);
    return {
      id: u._id.toHexString(),
      email,
      role,
      status: st,
      projectIds: Array.isArray(u.project_ids) ? u.project_ids.map(String) : [],
      isAdmin: role?.toLowerCase() === "admin"
    };
  });
}
