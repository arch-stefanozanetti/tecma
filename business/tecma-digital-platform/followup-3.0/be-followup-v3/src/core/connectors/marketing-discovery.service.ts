/**
 * Elenchi account (Google Ads, GA4 via OAuth utente, Meta ad accounts) per tendine FE.
 */
import { ENV } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import {
  getMarketingGoogleAdsOAuthSecrets,
  getMarketingMetaAdsAccessToken,
} from "./marketing-analytics-config.service.js";
import { getGoogleMarketingOAuthClientConfig } from "./marketing-google-oauth.service.js";

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
/**
 * REST Google Ads — versione major (path URL). Aggiornare quando la versione viene sunsettata
 * (vedi https://developers.google.com/google-ads/api/docs/sunset-dates). v19+ rimosse → 404 HTML generico.
 */
const GOOGLE_ADS_API = "https://googleads.googleapis.com/v23";
const GA_ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
const FB_GRAPH = "https://graph.facebook.com/v19.0";

const GA4_ACCOUNT_SUMMARIES_PAGE_SIZE = 200;

export type AdsCustomerOption = { customerId: string; resourceName: string };
export type Ga4PropertyOption = {
  propertyId: string;
  displayName: string;
  accountDisplayName?: string;
};
export type MetaAdAccountOption = { id: string; name?: string; accountId: string };

export type Ga4ListFailureCode =
  | "MARKETING_GOOGLE_NOT_LINKED"
  | "GA4_TOKEN_FAILED"
  | "GA4_ADMIN_API_ERROR"
  | "GA4_PARSE_ERROR";

export type ListGa4PropertiesOutcome =
  | { ok: true; properties: Ga4PropertyOption[] }
  | {
      ok: false;
      code: Ga4ListFailureCode;
      message: string;
      hint?: string;
      upstreamStatus?: number;
    };

export type AdsListFailureCode =
  | "MARKETING_GOOGLE_NOT_LINKED"
  | "ADS_DEVELOPER_TOKEN_MISSING"
  | "ADS_TOKEN_FAILED"
  | "ADS_GOOGLE_API_ERROR"
  | "ADS_PARSE_ERROR";

export type ListGoogleAdsCustomersOutcome =
  | { ok: true; customers: AdsCustomerOption[] }
  | {
      ok: false;
      code: AdsListFailureCode;
      message: string;
      hint?: string;
      upstreamStatus?: number;
    };

async function getGoogleAccessTokenForWorkspace(workspaceId: string): Promise<string | null> {
  const oauth = await getMarketingGoogleAdsOAuthSecrets(workspaceId);
  if (!oauth?.refreshToken) return null;
  try {
    const { clientId, clientSecret } = getGoogleMarketingOAuthClientConfig();
    const body = new URLSearchParams({
      refresh_token: oauth.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });
    const res = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      logger.warn(
        {
          workspaceId,
          status: res.status,
          bodyPreview: text.slice(0, 500),
        },
        "Google refresh token failed for discovery (OAuth marketing)"
      );
      return null;
    }
    const json = JSON.parse(text) as { access_token?: string };
    return json.access_token?.trim() || null;
  } catch (e) {
    logger.warn({ err: e, workspaceId }, "Google OAuth discovery token error");
    return null;
  }
}

/** Token OAuth utente (scope Ads + Analytics) per il connettore marketing Google del workspace. */
export async function getGoogleMarketingUserAccessToken(workspaceId: string): Promise<string | null> {
  return getGoogleAccessTokenForWorkspace(workspaceId);
}

function parseGoogleApiErrorMessage(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: { message?: string } };
    const msg = j?.error?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    /* ignore */
  }
  return text.slice(0, 200);
}

/**
 * Elenco proprietà GA4 per workspace via Google Analytics Admin API (`accountSummaries`).
 * In caso di errore upstream o configurazione, restituisce `ok: false` (il route mapperà in HTTP 424).
 */
export async function listGa4PropertiesForWorkspaceWithOutcome(workspaceId: string): Promise<ListGa4PropertiesOutcome> {
  const oauth = await getMarketingGoogleAdsOAuthSecrets(workspaceId);
  if (!oauth?.refreshToken) {
    return {
      ok: false,
      code: "MARKETING_GOOGLE_NOT_LINKED",
      message: "Google marketing non collegato per questo workspace.",
      hint: "Apri Integrazioni → Big Data e completa «Collega Google», poi ricarica gli elenchi.",
    };
  }

  const access = await getGoogleAccessTokenForWorkspace(workspaceId);
  if (!access) {
    logger.warn({ workspaceId }, "GA4 discovery: refresh token present but access token exchange failed");
    return {
      ok: false,
      code: "GA4_TOKEN_FAILED",
      message: "Impossibile ottenere un access token Google per leggere GA4.",
      hint: "Prova «Disconnetti Google» e «Collega Google» di nuovo in Integrazioni. Controlla i log del server se il problema persiste.",
    };
  }

  const out: Ga4PropertyOption[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const url = new URL(`${GA_ADMIN}/accountSummaries`);
      url.searchParams.set("pageSize", String(GA4_ACCOUNT_SUMMARIES_PAGE_SIZE));
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${access}` },
      });
      const text = await res.text();

      if (!res.ok) {
        const googleMsg = parseGoogleApiErrorMessage(text);
        logger.warn(
          {
            workspaceId,
            httpStatus: res.status,
            bodyPreview: text.slice(0, 800),
            googleMessage: googleMsg,
            hadPageToken: Boolean(pageToken),
          },
          "[GA4] accountSummaries failed — diagnostic: enable «Google Analytics Admin API» on the OAuth client GCP project; confirm OAuth scopes include analytics.readonly; confirm the Google user has GA4 property access"
        );
        return {
          ok: false,
          code: "GA4_ADMIN_API_ERROR",
          message: `Google Analytics Admin ha risposto con errore (HTTP ${res.status}).`,
          hint:
            res.status === 403 || res.status === 401
              ? "Nel progetto Google Cloud dell’OAuth marketing abilita l’API «Google Analytics Admin». Verifica che l’account usato al login abbia accesso alle proprietà GA4 in analytics.google.com."
              : "Controlla i log del server per il messaggio dettagliato Google. Spesso manca l’abilitazione di Google Analytics Admin API o i permessi sull’account GA4.",
          upstreamStatus: res.status,
        };
      }

      let json: {
        accountSummaries?: Array<{
          displayName?: string;
          propertySummaries?: Array<{ property?: string; displayName?: string }>;
        }>;
        nextPageToken?: string;
      };
      try {
        json = JSON.parse(text) as typeof json;
      } catch (parseErr) {
        logger.warn(
          { err: parseErr, workspaceId, textPreview: text.slice(0, 200) },
          "GA4 accountSummaries JSON parse failed"
        );
        return {
          ok: false,
          code: "GA4_PARSE_ERROR",
          message: "Risposta non valida dall’API Google Analytics Admin.",
          hint: "Riprova più tardi o controlla i log del server.",
        };
      }

      for (const acc of json.accountSummaries ?? []) {
        const accountDisplayName = acc.displayName;
        for (const p of acc.propertySummaries ?? []) {
          const prop = p.property ?? "";
          const m = prop.match(/properties\/(\d+)/);
          const propertyId = m?.[1] ?? prop.replace(/^properties\//, "");
          if (!propertyId) continue;
          out.push({
            propertyId,
            displayName: p.displayName || propertyId,
            accountDisplayName,
          });
        }
      }

      pageToken = json.nextPageToken?.trim() || undefined;
    } while (pageToken);

    return { ok: true, properties: out };
  } catch (e) {
    logger.warn({ err: e, workspaceId }, "GA4 accountSummaries exception");
    return {
      ok: false,
      code: "GA4_ADMIN_API_ERROR",
      message: "Errore di rete o imprevisto durante la lettura delle proprietà GA4.",
      hint: "Riprova tra qualche istante. Se persiste, controlla i log del server.",
    };
  }
}

/** Etichetta leggibile per una property GA4 già nota per ID (stesso elenco Admin API dei picker). */
export async function lookupGa4PropertyDisplayLabel(
  workspaceId: string,
  propertyId: string
): Promise<string | undefined> {
  const id = propertyId.trim();
  if (!id) return undefined;
  const outcome = await listGa4PropertiesForWorkspaceWithOutcome(workspaceId);
  if (!outcome.ok) return undefined;
  const hit = outcome.properties.find((p) => p.propertyId === id);
  if (!hit) return undefined;
  const acc = hit.accountDisplayName?.trim();
  const name = hit.displayName?.trim();
  if (acc && name) return `${acc} — ${name}`;
  return name || acc;
}


/**
 * Elenco customer Google Ads accessibili all’utente OAuth (`customers:listAccessibleCustomers`).
 * Richiede `GOOGLE_ADS_DEVELOPER_TOKEN` sul server e API Google Ads abilitata sul progetto GCP dell’OAuth.
 */
export async function listGoogleAdsAccessibleCustomersWithOutcome(
  workspaceId: string
): Promise<ListGoogleAdsCustomersOutcome> {
  const oauth = await getMarketingGoogleAdsOAuthSecrets(workspaceId);
  if (!oauth?.refreshToken) {
    return {
      ok: false,
      code: "MARKETING_GOOGLE_NOT_LINKED",
      message: "Google marketing non collegato per questo workspace.",
      hint: "Apri Integrazioni → Big Data e completa «Collega Google», poi ricarica gli elenchi.",
    };
  }

  const devToken = ENV.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!devToken) {
    logger.warn("GOOGLE_ADS_DEVELOPER_TOKEN mancante: elenco customer Ads disabilitato");
    return {
      ok: false,
      code: "ADS_DEVELOPER_TOKEN_MISSING",
      message: "Developer token Google Ads non configurato sul server.",
      hint: "Imposta la variabile d’ambiente GOOGLE_ADS_DEVELOPER_TOKEN nel backend (token dalla Google Ads API Center). Poi riavvia il servizio e ricarica gli elenchi.",
    };
  }

  const access = await getGoogleAccessTokenForWorkspace(workspaceId);
  if (!access) {
    logger.warn({ workspaceId }, "Google Ads discovery: access token exchange failed");
    return {
      ok: false,
      code: "ADS_TOKEN_FAILED",
      message: "Impossibile ottenere un access token Google per chiamare l’API Google Ads.",
      hint: "Prova «Disconnetti Google» e «Collega Google» di nuovo in Integrazioni.",
    };
  }

  try {
    // Documentazione ufficiale: GET (non POST) su customers:listAccessibleCustomers
    const res = await fetch(`${GOOGLE_ADS_API}/customers:listAccessibleCustomers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access}`,
        "developer-token": devToken,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();

    if (!res.ok) {
      const googleMsg = parseGoogleApiErrorMessage(text);
      logger.warn(
        {
          workspaceId,
          httpStatus: res.status,
          bodyPreview: text.slice(0, 800),
          googleMessage: googleMsg,
        },
        "[Google Ads] listAccessibleCustomers failed — enable «Google Ads API» on OAuth GCP project; check developer token access level; user must have access to Ads accounts"
      );
      const detail =
        googleMsg && googleMsg.length > 0 ? ` Dettaglio: ${googleMsg.slice(0, 400)}` : "";
      let baseHint: string;
      if (res.status === 403 || res.status === 401) {
        baseHint =
          "Nel progetto Google Cloud dell’OAuth marketing abilita l’API «Google Ads API». Verifica che il developer token sia attivo e che l’account Google del login abbia accesso agli account pubblicitari in ads.google.com.";
      } else if (res.status === 404) {
        baseHint =
          "HTTP 404 di solito indica endpoint/versione REST non più valida oppure API non abilitata sul progetto GCP usato dall’OAuth. Abilita «Google Ads API» in Google Cloud, controlla che il developer token sia approvato (Google Ads API Center) e che l’utente collegato abbia ruolo sugli account in ads.google.com.";
      } else {
        baseHint =
          "Controlla i log del server. Spesso serve abilitare Google Ads API, approvare il developer token o usare l’account Google corretto per Google Ads.";
      }
      return {
        ok: false,
        code: "ADS_GOOGLE_API_ERROR",
        message: `Google Ads API ha risposto con errore (HTTP ${res.status}).`,
        hint: `${baseHint}${detail}`,
        upstreamStatus: res.status,
      };
    }

    let json: { resourceNames?: string[] };
    try {
      json = JSON.parse(text) as { resourceNames?: string[] };
    } catch (parseErr) {
      logger.warn({ err: parseErr, workspaceId, textPreview: text.slice(0, 200) }, "listAccessibleCustomers JSON parse failed");
      return {
        ok: false,
        code: "ADS_PARSE_ERROR",
        message: "Risposta non valida dall’API Google Ads.",
        hint: "Riprova più tardi o controlla i log del server.",
      };
    }

    const names = json.resourceNames ?? [];
    const customers = names.map((resourceName) => {
      const m = resourceName.match(/^customers\/(\d+)$/);
      const customerId = m?.[1] ?? resourceName.replace(/^customers\//, "");
      return { customerId, resourceName };
    });
    return { ok: true, customers };
  } catch (e) {
    logger.warn({ err: e, workspaceId }, "listAccessibleCustomers exception");
    return {
      ok: false,
      code: "ADS_GOOGLE_API_ERROR",
      message: "Errore di rete o imprevisto durante la lettura degli account Google Ads.",
      hint: "Riprova tra qualche istante. Se persiste, controlla i log del server.",
    };
  }
}

/** Compat: elenco senza metadati errore. */
export async function listGoogleAdsAccessibleCustomers(workspaceId: string): Promise<AdsCustomerOption[]> {
  const r = await listGoogleAdsAccessibleCustomersWithOutcome(workspaceId);
  return r.ok ? r.customers : [];
}

/** Compat: elenco senza metadati errore (es. script interni). */
export async function listGa4PropertiesForWorkspace(workspaceId: string): Promise<Ga4PropertyOption[]> {
  const r = await listGa4PropertiesForWorkspaceWithOutcome(workspaceId);
  return r.ok ? r.properties : [];
}

export async function listMetaAdAccountsForWorkspace(workspaceId: string): Promise<MetaAdAccountOption[]> {
  const token = await getMarketingMetaAdsAccessToken(workspaceId);
  if (!token) return [];
  try {
    const url = new URL(`${FB_GRAPH}/me/adaccounts`);
    url.searchParams.set("fields", "id,name,account_id");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const text = await res.text();
    if (!res.ok) {
      logger.warn({ workspaceId, status: res.status, body: text.slice(0, 300) }, "Meta adaccounts failed");
      return [];
    }
    const json = JSON.parse(text) as {
      data?: Array<{ id?: string; name?: string; account_id?: string }>;
    };
    const rows = json.data ?? [];
    return rows
      .filter((r) => r.id)
      .map((r) => ({
        id: r.id!,
        name: r.name,
        accountId: r.account_id ?? r.id!.replace(/^act_/, ""),
      }));
  } catch (e) {
    logger.warn({ err: e, workspaceId }, "Meta adaccounts exception");
    return [];
  }
}
