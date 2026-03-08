const JWT_COOKIE_KEYS = ["jwt", "token", "access_token", "id_token", "auth_token"];

export const isLocalDevHost = (): boolean => {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
};

const getCookieValue = (key: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${key}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null;
  }
  return null;
};

export const getJwtFromCookie = (): string | null => {
  for (const key of JWT_COOKIE_KEYS) {
    const value = getCookieValue(key);
    if (value) return value;
  }
  return null;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = atob(normalized);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const getEmailFromJwtCookie = (): string | null => {
  const token = getJwtFromCookie();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

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

const ensureLoginPath = (url: string): string => {
  const normalized = url.endsWith("/") ? url.slice(0, -1) : url;
  if (normalized.endsWith("/login")) return normalized;
  return `${normalized}/login`;
};

export const buildBackToFromCurrentLocation = (): string => {
  const params = new URLSearchParams(window.location.search);
  const explicitBackTo = params.get("backTo");
  if (explicitBackTo) return explicitBackTo;

  const url = new URL(window.location.href);
  const queryParams = new URLSearchParams(url.search);
  queryParams.delete("hostname");
  queryParams.delete("backTo");

  const query = queryParams.toString();
  return `${window.location.origin}${url.pathname}${query ? `?${query}` : ""}`;
};

export const buildItdLoginRedirectUrl = (businessPlatformLoginUrl: string): string => {
  const loginBase = ensureLoginPath(businessPlatformLoginUrl);
  const backTo = buildBackToFromCurrentLocation();
  const separator = loginBase.includes("?") ? "&" : "?";

  return `${loginBase}${separator}backTo=${encodeURIComponent(backTo)}`;
};
