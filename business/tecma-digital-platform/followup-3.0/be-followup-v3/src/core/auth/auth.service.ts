import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { ENV } from "../../config/env.js";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { logAuthEvent } from "./authAudit.service.js";
import { createSession, deleteSession, getSession } from "./refreshSession.service.js";
import { signAccessToken } from "./token.service.js";

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

export const loginWithCredentials = async (rawInput: unknown) => {
  const { email, password } = LoginInputSchema.parse(rawInput);

  const user = await findLegacyUserByEmail(email);
  if (!user || !user.password) {
    throw new HttpError("Credenziali non valide", 401);
  }

  if (user.isDisabled) {
    throw new HttpError("Utente disabilitato", 401);
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    throw new HttpError("Credenziali non valide", 401);
  }

  const role = (user.role || "").toLowerCase() || null;
  const isAdmin = role === "admin";

  const accessToken = signAccessToken({
    sub: user._id.toHexString(),
    email: (user.email || email).toLowerCase(),
    role,
    isAdmin
  });

  const refreshToken = await createSession(user._id.toHexString(), (user.email || email).toLowerCase());

  return {
    accessToken,
    refreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN,
    user: {
      id: user._id.toHexString(),
      email: (user.email || email).toLowerCase(),
      role,
      isAdmin
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
  const role = (user.role || "").toLowerCase() || null;
  const isAdmin = role === "admin";
  const accessToken = signAccessToken({
    sub: user._id.toHexString(),
    email: (user.email || email).toLowerCase(),
    role,
    isAdmin
  });

  const refreshToken = await createSession(user._id.toHexString(), (user.email || email).toLowerCase());
  const userEmail = (user.email || email).toLowerCase();
  await logAuthEvent("sso_exchange", { userId: user._id.toHexString(), email: userEmail });

  return {
    accessToken,
    refreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN,
    user: {
      id: user._id.toHexString(),
      email: userEmail,
      role,
      isAdmin
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
  const role = (user.role || "").toLowerCase() || null;
  const isAdmin = role === "admin";
  const email = (user.email || session.email || "").toLowerCase();

  const payload = {
    sub: user._id.toHexString(),
    email,
    role,
    isAdmin
  };
  const accessToken = signAccessToken(payload);

  // Rotate refresh token: delete old, create new
  await deleteSession(refreshToken);
  const newRefreshToken = await createSession(user._id.toHexString(), email);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN
  };
};

export const logoutWithRefreshToken = async (rawInput: unknown): Promise<void> => {
  const { refreshToken } = RefreshInputSchema.parse(rawInput);
  const session = await getSession(refreshToken);
  if (session) {
    await logAuthEvent("logout", { userId: session.userId, email: session.email });
  }
  await deleteSession(refreshToken);
};

