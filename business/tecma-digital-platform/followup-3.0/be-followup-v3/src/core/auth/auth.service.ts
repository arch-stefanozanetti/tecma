import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { ENV } from "../../config/env.js";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import { HttpError } from "../../types/http.js";
import { sendPasswordResetEmail } from "../email/email.service.js";
import { logAuthEvent } from "./authAudit.service.js";
import {
  createSession,
  deleteSession,
  deleteSessionsByUser,
  getSession
} from "./refreshSession.service.js";
import { createPasswordResetToken, consumePasswordResetToken } from "./passwordResetToken.service.js";
import { signAccessToken } from "./token.service.js";
import { verifySsoJwtAndGetPayload } from "./ssoJwtVerify.service.js";
import { assertPasswordMeetsPolicy } from "./passwordPolicy.js";
import { isEmailLocked, clearLockoutForEmail, recordFailedPasswordAttempt } from "./accountLockout.service.js";
import { isMfaEnabledForUser, verifyMfaForLogin } from "./mfa.service.js";
import { signMfaPendingToken, verifyMfaPendingToken } from "./mfaPendingToken.service.js";
import { emailRequiresMfaByWorkspacePolicy } from "../workspaces/workspaceMfaPolicy.service.js";
import { observeSecurityMfaFailure } from "../../observability/metrics.js";
import { recordSecurityEvent } from "../compliance/security-audit.service.js";
import {
  USER_COLLECTION_CANDIDATES,
  buildAccessPayloadFromUserDoc,
  escapeEmailForRegex,
  toAuthSessionUser,
  type UserDocForAccessPayload
} from "./userAccessPayload.js";

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type LegacyUserDoc = UserDocForAccessPayload & {
  isDisabled?: boolean;
  password?: string;
  status?: string;
};

/** Hash fittizio per allineare il tempo di risposta su login fallito */
const DUMMY_BCRYPT = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.GJ.nVvC7KQKz6";

let cachedUserCollectionName: string | null = null;

const detectUserCollectionName = async (): Promise<string> => {
  if (cachedUserCollectionName) return cachedUserCollectionName;
  const db = getDb();
  for (const name of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (exists) {
      cachedUserCollectionName = name;
      return name;
    }
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
  const normalized = escapeEmailForRegex(email);
  return users.findOne({
    email: { $regex: `^${normalized}$`, $options: "i" }
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

function invitedCannotLogin(u: LegacyUserDoc): boolean {
  if (u.status === "invited") return true;
  if (!u.password) return true;
  return false;
}

export type AuthRequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export const loginWithCredentials = async (rawInput: unknown, meta: AuthRequestMeta = {}) => {
  const { email, password } = LoginInputSchema.parse(rawInput);
  const emailLower = email.toLowerCase();

  const lockedUntil = await isEmailLocked(emailLower);
  if (lockedUntil) {
    await bcrypt.compare(password, DUMMY_BCRYPT);
    await logAuthEvent("login_failed", {
      email: emailLower,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false
    });
    throw new HttpError(
      "Account temporaneamente bloccato per troppi tentativi falliti. Riprova più tardi.",
      403,
      "ACCOUNT_LOCKED"
    );
  }

  const user = await findLegacyUserByEmail(email);

  const failLogin = async (recordLockout: boolean) => {
    await bcrypt.compare(password, DUMMY_BCRYPT);
    if (recordLockout && user?.password && !user.isDisabled && !invitedCannotLogin(user)) {
      await recordFailedPasswordAttempt(emailLower);
    }
    await logAuthEvent("login_failed", {
      email: emailLower,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false
    });
    throw new HttpError("Credenziali non valide", 401);
  };

  if (!user || user.isDisabled || invitedCannotLogin(user)) {
    await failLogin(false);
    return null as never;
  }

  const passwordOk = await bcrypt.compare(password, user.password!);
  if (!passwordOk) {
    await failLogin(true);
    return null as never;
  }

  await clearLockoutForEmail(emailLower);

  const userIdHex = user._id.toHexString();
  const mustEnrollMfa = await emailRequiresMfaByWorkspacePolicy(emailLower);
  const mfaOn = await isMfaEnabledForUser(userIdHex);
  if (mustEnrollMfa && !mfaOn) {
    await logAuthEvent("login_failed", {
      userId: userIdHex,
      email: emailLower,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false
    });
    throw new HttpError(
      "È obbligatorio attivare l'autenticazione a due fattori. Accedi con un account che ha già MFA oppure contatta un amministratore.",
      403,
      "MFA_ENROLLMENT_REQUIRED"
    );
  }

  if (mfaOn) {
    const mfaToken = signMfaPendingToken({ sub: userIdHex, email: emailLower });
    await logAuthEvent("mfa_challenge_issued", {
      userId: userIdHex,
      email: emailLower,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: true
    });
    return {
      mfaRequired: true as const,
      mfaToken,
      expiresIn: ENV.AUTH_MFA_PENDING_EXPIRES_IN
    };
  }

  try {
    const payload = await buildAccessPayloadFromUserDoc(user, email);
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
      mfaRequired: false as const,
      accessToken,
      refreshToken,
      expiresIn: ENV.AUTH_JWT_EXPIRES_IN,
      user: toAuthSessionUser(payload)
    };
  } catch (err) {
    logger.error({ err, email: emailLower }, "[auth] login success path failed");
    throw new HttpError("Errore durante l'accesso. Riprova più tardi.", 500);
  }
};

const MfaVerifyLoginSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(6).max(32)
});

export const completeLoginWithMfa = async (rawInput: unknown, meta: AuthRequestMeta = {}) => {
  const { mfaToken, code } = MfaVerifyLoginSchema.parse(rawInput);
  const pending = verifyMfaPendingToken(mfaToken);
  const user = await findLegacyUserById(pending.sub);
  if (!user || user.isDisabled || invitedCannotLogin(user)) {
    throw new HttpError("Credenziali non valide", 401);
  }
  const userEmail = (user.email || "").toLowerCase();
  if (userEmail !== pending.email.toLowerCase()) {
    throw new HttpError("Token MFA non valido", 401);
  }
  const ok = await verifyMfaForLogin(pending.sub, code);
  if (!ok) {
    observeSecurityMfaFailure();
    await logAuthEvent("mfa_failed", {
      userId: pending.sub,
      email: pending.email,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false
    });
    throw new HttpError("Codice MFA non valido", 401);
  }

  try {
    const payload = await buildAccessPayloadFromUserDoc(user, user.email || pending.email);
    const accessToken = signAccessToken(payload);
    const refreshToken = await createSession(payload.sub, payload.email);
    await logAuthEvent("mfa_success", {
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
  } catch (err) {
    logger.error({ err, email: pending.email }, "[auth] MFA login completion failed");
    throw new HttpError("Errore durante l'accesso. Riprova più tardi.", 500);
  }
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

const SSO_GENERIC_401 = "Accesso SSO non consentito";

export const exchangeSsoJwt = async (rawInput: unknown) => {
  const { ssoJwt } = SsoExchangeInputSchema.parse(rawInput);
  let decoded: Record<string, unknown>;
  try {
    decoded = await verifySsoJwtAndGetPayload(ssoJwt);
  } catch (e) {
    if (e instanceof HttpError && e.statusCode === 503) throw e;
    throw new HttpError(SSO_GENERIC_401, 401);
  }
  const email = extractEmailFromSsoPayload(decoded);
  if (!email) {
    throw new HttpError(SSO_GENERIC_401, 401);
  }
  const user = await findLegacyUserByEmail(email);
  if (!user || user.isDisabled) {
    throw new HttpError(SSO_GENERIC_401, 401);
  }
  const payload = await buildAccessPayloadFromUserDoc(user, email);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createSession(user._id.toHexString(), payload.email);
  await logAuthEvent("sso_exchange", { userId: payload.sub, email: payload.email, success: true });

  return {
    accessToken,
    refreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN,
    user: toAuthSessionUser(payload)
  };
};

const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1)
});

export const refreshAccessToken = async (rawInput: unknown) => {
  const { refreshToken } = RefreshInputSchema.parse(rawInput);
  const session = await getSession(refreshToken);
  if (!session) {
    throw new HttpError("Refresh token non valido o scaduto", 401);
  }
  const user = await findLegacyUserById(session.userId);
  if (!user || user.isDisabled) {
    await deleteSession(refreshToken);
    throw new HttpError("Refresh token non valido o scaduto", 401);
  }
  const email = (user.email || session.email || "").toLowerCase();
  const payload = await buildAccessPayloadFromUserDoc(user, email);
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
  password: z.string().min(1)
});

export const resetPasswordWithToken = async (rawInput: unknown, meta: AuthRequestMeta = {}) => {
  const { token, password } = ResetPasswordSchema.parse(rawInput);
  assertPasswordMeetsPolicy(password);
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
  void recordSecurityEvent({
    action: "auth.password_reset_completed",
    entityType: "user",
    entityId: consumed.userId,
    userId: consumed.userId,
    ip: meta.ipAddress ?? undefined,
    userAgent: meta.userAgent ?? undefined
  });
  return { ok: true };
};
