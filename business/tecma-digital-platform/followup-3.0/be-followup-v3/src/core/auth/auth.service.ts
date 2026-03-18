import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { ENV } from "../../config/env.js";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { sendPasswordResetEmail } from "../email/email.service.js";
import { PERMISSIONS } from "../rbac/permissions.js";
import { resolveEffectivePermissions } from "../rbac/roleDefinitions.service.js";
import { logAuthEvent } from "./authAudit.service.js";
import {
  createSession,
  deleteSession,
  deleteSessionsByUser,
  getSession
} from "./refreshSession.service.js";
import { createPasswordResetToken, consumePasswordResetToken } from "./passwordResetToken.service.js";
import { signAccessToken, type AccessTokenPayload } from "./token.service.js";

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type LegacyUserDoc = {
  _id: ObjectId;
  email?: string;
  role?: string;
  isDisabled?: boolean;
  password?: string;
  status?: string;
  permissions_override?: string[];
  project_ids?: string[];
};

const USER_COLLECTION_CANDIDATES = ["tz_users", "users", "Users", "user", "User", "backoffice_users"];

const detectUserCollectionName = async (): Promise<string> => {
  const db = getDb();
  for (const name of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (exists) return name;
  }
  const available = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  throw new Error(
    `User collection not found in db "${db.databaseName}". Available collections: [${available.join(", ")}]`
  );
};

const findLegacyUserByEmail = async (email: string): Promise<LegacyUserDoc | null> => {
  const db = getDb();
  const collectionName = await detectUserCollectionName();
  const users = db.collection<LegacyUserDoc>(collectionName);
  const normalized = email.trim().toLowerCase();
  return users.findOne({
    email: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });
};

const findLegacyUserById = async (userId: string): Promise<LegacyUserDoc | null> => {
  if (!ObjectId.isValid(userId)) return null;
  const db = getDb();
  const collectionName = await detectUserCollectionName();
  const users = db.collection<LegacyUserDoc>(collectionName);
  return users.findOne({ _id: new ObjectId(userId) });
};

async function findUserDocByIdAcrossCollections(userId: string): Promise<{
  collection: string;
  doc: LegacyUserDoc;
} | null> {
  if (!ObjectId.isValid(userId)) return null;
  const id = new ObjectId(userId);
  const db = getDb();
  for (const name of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) continue;
    const doc = await db.collection<LegacyUserDoc>(name).findOne({ _id: id });
    if (doc) return { collection: name, doc };
  }
  return null;
}

async function buildTokenPayload(user: LegacyUserDoc, emailFallback: string): Promise<AccessTokenPayload> {
  const role = (user.role || "").toLowerCase() || null;
  const perms = await resolveEffectivePermissions(role, user.permissions_override);
  const isAdmin = perms.includes(PERMISSIONS.ALL);
  const projectId =
    Array.isArray(user.project_ids) && user.project_ids.length > 0 ? String(user.project_ids[0]) : null;
  return {
    sub: user._id.toHexString(),
    email: (user.email || emailFallback).toLowerCase(),
    role,
    isAdmin,
    permissions: perms,
    projectId
  };
}

function invitedCannotLogin(u: LegacyUserDoc): boolean {
  if (u.status === "invited") return true;
  if (!u.password) return true;
  return false;
}

export type AuthRequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export const loginWithCredentials = async (rawInput: unknown, meta: AuthRequestMeta = {}) => {
  const { email, password } = LoginInputSchema.parse(rawInput);
  const user = await findLegacyUserByEmail(email);

  const fail = async () => {
    await logAuthEvent("login_failed", {
      email: email.toLowerCase(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false
    });
    throw new HttpError("Credenziali non valide", 401);
  };

  if (!user) {
    await fail();
    return null as never;
  }

  const u = user;

  if (u.isDisabled) {
    await logAuthEvent("login_failed", {
      userId: u._id.toHexString(),
      email: (u.email || email).toLowerCase(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false
    });
    throw new HttpError("Utente disabilitato", 401);
  }

  if (invitedCannotLogin(u)) {
    await fail();
    return null as never;
  }

  const passwordOk = await bcrypt.compare(password, u.password!);
  if (!passwordOk) {
    await fail();
    return null as never;
  }

  const payload = await buildTokenPayload(u, email);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createSession(payload.sub, payload.email);
  await logAuthEvent("login_success", {
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
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isAdmin: payload.isAdmin,
      permissions: payload.permissions,
      projectId: payload.projectId
    }
  };
};

const extractEmailFromSsoPayload = (payload: Record<string, unknown>): string | null => {
  const userData = (payload.user ?? payload.data ?? payload.profile ?? {}) as Record<string, unknown>;
  const candidates = [
    payload.email,
    payload.userEmail,
    payload.username,
    payload.preferred_username,
    payload.upn,
    payload.sub,
    userData.email,
    userData.userEmail,
    userData.username
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) {
      return candidate.toLowerCase();
    }
  }
  return null;
};

const SsoExchangeInputSchema = z.object({
  ssoJwt: z.string().min(1)
});

export const exchangeSsoJwt = async (rawInput: unknown) => {
  const { ssoJwt } = SsoExchangeInputSchema.parse(rawInput);
  const decoded = jwt.decode(ssoJwt) as Record<string, unknown> | null;
  if (!decoded || typeof decoded !== "object") {
    throw new HttpError("Token SSO non valido", 401);
  }
  const email = extractEmailFromSsoPayload(decoded);
  if (!email) {
    throw new HttpError("Impossibile ricavare l'email dal token SSO", 401);
  }
  const user = await findLegacyUserByEmail(email);
  if (!user) {
    throw new HttpError("Utente non trovato per questa sessione SSO", 401);
  }
  if (user.isDisabled) {
    throw new HttpError("Utente disabilitato", 401);
  }
  const payload = await buildTokenPayload(user, email);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createSession(user._id.toHexString(), payload.email);
  await logAuthEvent("sso_exchange", { userId: payload.sub, email: payload.email, success: true });

  return {
    accessToken,
    refreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN,
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isAdmin: payload.isAdmin,
      permissions: payload.permissions,
      projectId: payload.projectId
    }
  };
};

const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1)
});

export const refreshAccessToken = async (rawInput: unknown) => {
  const { refreshToken } = RefreshInputSchema.parse(rawInput);
  const session = await getSession(refreshToken);
  if (!session) {
    throw new HttpError("Invalid or expired refresh token", 401);
  }
  const user = await findLegacyUserById(session.userId);
  if (!user || user.isDisabled) {
    await deleteSession(refreshToken);
    throw new HttpError("User not found or disabled", 401);
  }
  const email = (user.email || session.email || "").toLowerCase();
  const payload = await buildTokenPayload(user, email);
  const accessToken = signAccessToken(payload);
  await deleteSession(refreshToken);
  const newRefreshToken = await createSession(user._id.toHexString(), email);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN
  };
};

export const logoutWithRefreshToken = async (rawInput: unknown, meta: AuthRequestMeta = {}): Promise<void> => {
  const { refreshToken } = RefreshInputSchema.parse(rawInput);
  const session = await getSession(refreshToken);
  if (session) {
    await logAuthEvent("logout", {
      userId: session.userId,
      email: session.email,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: true
    });
  }
  await deleteSession(refreshToken);
};

const RequestResetSchema = z.object({
  email: z.string().email()
});

export const requestPasswordReset = async (rawInput: unknown, meta: AuthRequestMeta = {}) => {
  const { email } = RequestResetSchema.parse(rawInput);
  const user = await findLegacyUserByEmail(email);
  await logAuthEvent("password_reset_requested", {
    userId: user?._id.toHexString(),
    email: email.toLowerCase(),
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    success: true
  });
  if (!user?.password || user.isDisabled || invitedCannotLogin(user)) {
    return { ok: true };
  }
  const raw = await createPasswordResetToken(user._id.toHexString(), user.email || email);
  await sendPasswordResetEmail({ to: (user.email || email).toLowerCase(), token: raw });
  return { ok: true };
};

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

export const resetPasswordWithToken = async (rawInput: unknown, meta: AuthRequestMeta = {}) => {
  const { token, password } = ResetPasswordSchema.parse(rawInput);
  const consumed = await consumePasswordResetToken(token);
  if (!consumed) {
    throw new HttpError("Token non valido o scaduto", 400);
  }
  const located = await findUserDocByIdAcrossCollections(consumed.userId);
  if (!located) {
    throw new HttpError("Token non valido", 400);
  }
  const hash = await bcrypt.hash(password, 12);
  await getDb()
    .collection(located.collection)
    .updateOne({ _id: located.doc._id }, { $set: { password: hash, status: "active" } });
  await deleteSessionsByUser(consumed.userId);
  await logAuthEvent("password_reset_completed", {
    userId: consumed.userId,
    email: consumed.email,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    success: true
  });
  return { ok: true };
};
