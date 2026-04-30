/**
 * API di autenticazione unificata: delega a Followup (be-followup-v3) o a BSS (gateway)
 * in base a VITE_USE_BSS_AUTH. Con BSS è richiesto projectId al login.
 */
import { followupApi } from "./followupApi";
import { loginBss, meBss, refreshBss } from "./bssAuthAdapter";

const isBssAuthEnabled = (): boolean =>
  typeof import.meta.env.VITE_USE_BSS_AUTH === "string" &&
  import.meta.env.VITE_USE_BSS_AUTH.toLowerCase() === "true";

export interface AuthUser {
  id: string;
  email: string;
  role: string | null;
  isAdmin: boolean;
  permissions?: string[];
  projectId?: string | null;
  system_role?: string;
  isTecmaAdmin?: boolean;
  mfaEnabled?: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  user: AuthUser;
}

/** Esito login Followup: token completi oppure secondo step MFA. */
export type LoginOutcome =
  | ({ step: "done" } & LoginResult)
  | { step: "mfa"; mfaToken: string; expiresIn?: string };

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
}

/** Login: con BSS richiede projectId; con Followup può richiedere step MFA (`step: "mfa"`). */
export async function login(email: string, password: string, projectId?: string): Promise<LoginOutcome> {
  if (isBssAuthEnabled()) {
    if (!projectId || !projectId.trim()) {
      throw new Error("Con auth BSS è obbligatorio selezionare un progetto (project_id).");
    }
    const r = await loginBss(email.trim(), password, projectId.trim());
    return { step: "done", ...r };
  }
  const result = await followupApi.login(email, password);
  if (result.mfaRequired) {
    return { step: "mfa", mfaToken: result.mfaToken, expiresIn: result.expiresIn };
  }
  return {
    step: "done",
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    user: result.user
  };
}

/** Completa il login dopo `step: "mfa"` (codice TOTP). */
export async function completeMfaLogin(mfaToken: string, totpCode: string): Promise<LoginResult> {
  if (isBssAuthEnabled()) {
    throw new Error("MFA non è gestito in questo flusso con auth BSS.");
  }
  const r = await followupApi.verifyMfaLogin(mfaToken, totpCode);
  return {
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiresIn: r.expiresIn,
    user: r.user
  };
}

/** Utente corrente (me). */
export async function me(): Promise<AuthUser> {
  if (isBssAuthEnabled()) return meBss();
  return followupApi.me();
}

/** Refresh token. */
export async function refresh(refreshToken: string): Promise<RefreshResult> {
  if (isBssAuthEnabled()) return refreshBss(refreshToken);
  return followupApi.refresh(refreshToken);
}

/** True se l'auth attiva è BSS (gateway). */
export function isBssAuth(): boolean {
  return isBssAuthEnabled();
}
