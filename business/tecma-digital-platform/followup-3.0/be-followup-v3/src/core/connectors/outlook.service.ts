/**
 * Connettore Outlook: OAuth2 Microsoft + Microsoft Graph per lettura calendario.
 * Collection tz_connector_credentials (connectorId: 'outlook').
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";

const COLLECTION = "tz_connector_credentials";
const CONNECTOR_ID = "outlook";
const TENANT = process.env.OUTLOOK_TENANT_ID ?? "common";
const SCOPES = ["https://graph.microsoft.com/Calendars.Read", "offline_access"];

function getConfig() {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new HttpError("Outlook connector not configured (OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_REDIRECT_URI)", 503);
  }
  return { clientId, clientSecret, redirectUri };
}

export interface OutlookCredentialRow {
  _id: string;
  userId: string;
  workspaceId?: string;
  connectorId: string;
  refreshToken: string;
  accessToken?: string;
  expiresAt?: string;
  updatedAt: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Genera URL di autorizzazione Microsoft (redirect utente a login).
 * state: JSON { userId, workspaceId } codificato per il callback.
 */
export function getAuthUrl(redirectUri: string, state: { userId: string; workspaceId?: string }): string {
  const { clientId } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    response_mode: "query",
    state: Buffer.from(JSON.stringify(state), "utf8").toString("base64url"),
  });
  return `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Scambia code per access + refresh token e salva in DB.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  state: { userId: string; workspaceId?: string }
): Promise<void> {
  const { clientId, clientSecret } = getConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(`Outlook token exchange failed: ${res.status} ${text}`, 400);
  }
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (json.expires_in ?? 3600) * 1000);
  const db = getDb();
  await db.collection(COLLECTION).updateOne(
    { userId: state.userId, connectorId: CONNECTOR_ID },
    {
      $set: {
        workspaceId: state.workspaceId,
        refreshToken: json.refresh_token,
        accessToken: json.access_token,
        expiresAt,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}

/**
 * Restituisce credenziali per user (e opzionale workspace). Rinnova access token se scaduto.
 */
async function getCredentials(userId: string, workspaceId?: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  updatedAt: Date;
} | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({
    userId,
    connectorId: CONNECTOR_ID,
    ...(workspaceId != null && workspaceId !== "" ? { workspaceId } : {}),
  });
  if (!doc) return null;
  const expiresAt = doc.expiresAt instanceof Date ? doc.expiresAt : new Date(String(doc.expiresAt));
  const now = new Date();
  const margin = 60 * 1000;
  if (expiresAt.getTime() - margin > now.getTime() && doc.accessToken) {
    return {
      accessToken: String(doc.accessToken),
      refreshToken: String(doc.refreshToken),
      expiresAt,
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(String(doc.updatedAt)),
    };
  }
  const { clientId, clientSecret } = getConfig();
  const refreshBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: String(doc.refreshToken),
    grant_type: "refresh_token",
  });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshBody.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, response: text }, "[outlook] token refresh failed");
    return null;
  }
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const newExpires = new Date(now.getTime() + (json.expires_in ?? 3600) * 1000);
  await db.collection(COLLECTION).updateOne(
    { _id: doc._id },
    {
      $set: {
        accessToken: json.access_token,
        ...(json.refresh_token && { refreshToken: json.refresh_token }),
        expiresAt: newExpires,
        updatedAt: now,
      },
    }
  );
  return {
    accessToken: json.access_token,
    refreshToken: (json.refresh_token as string) ?? String(doc.refreshToken),
    expiresAt: newExpires,
    updatedAt: now,
  };
}

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  isAllDay?: boolean;
  webLink?: string;
}

/**
 * Legge eventi calendario da Microsoft Graph.
 */
export async function getCalendarEvents(
  userId: string,
  dateFrom: string,
  dateTo: string,
  workspaceId?: string
): Promise<OutlookCalendarEvent[]> {
  const creds = await getCredentials(userId, workspaceId);
  if (!creds) throw new HttpError("Outlook not connected for this user", 401);
  const params = new URLSearchParams({
    startDateTime: dateFrom,
    endDateTime: dateTo,
  });
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/calendarView?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(`Microsoft Graph error: ${res.status} ${text}`, res.status === 401 ? 401 : 502);
  }
  const json = (await res.json()) as { value?: Array<{ id: string; subject?: string; start?: { dateTime: string; timeZone: string }; end?: { dateTime: string; timeZone: string }; isAllDay?: boolean; webLink?: string }> };
  const value = json.value ?? [];
  return value.map((e) => ({
    id: e.id,
    subject: e.subject ?? "",
    start: e.start?.dateTime ?? "",
    end: e.end?.dateTime ?? "",
    isAllDay: e.isAllDay,
    webLink: e.webLink,
  }));
}

/**
 * Verifica se l'utente ha connesso Outlook (per qualsiasi workspace o senza workspace).
 */
export async function hasOutlookConnected(userId: string): Promise<boolean> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ userId, connectorId: CONNECTOR_ID });
  return !!doc;
}

/**
 * Rimuove credenziali Outlook per l'utente (e opzionale workspace).
 */
export async function deleteOutlookCredentials(userId: string, workspaceId?: string): Promise<boolean> {
  const db = getDb();
  const filter: Record<string, unknown> = { userId, connectorId: CONNECTOR_ID };
  if (workspaceId != null && workspaceId !== "") filter.workspaceId = workspaceId;
  const result = await db.collection(COLLECTION).deleteMany(filter);
  return (result.deletedCount ?? 0) > 0;
}
