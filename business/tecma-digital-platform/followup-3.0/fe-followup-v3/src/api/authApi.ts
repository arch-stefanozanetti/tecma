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
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  user: AuthUser;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
}

/** Login: con BSS richiede projectId; con Followup projectId viene ignorato. */
export async function login(
  email: string,
  password: string,
  projectId?: string
): Promise<LoginResult> {
  if (isBssAuthEnabled()) {
    if (!projectId || !projectId.trim()) {
      throw new Error("Con auth BSS è obbligatorio selezionare un progetto (project_id).");
    }
    return loginBss(email.trim(), password, projectId.trim());
  }
  const result = await followupApi.login(email, password);
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    user: result.user
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
