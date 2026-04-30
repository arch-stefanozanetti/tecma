# Runbook: API marketing (Google Ads, GA4, Meta)

## Configurazione per progetto e per workspace (FollowUp UI)

- **Per progetto** (ID non sensibili): FollowUp → **Progetti** → dettaglio → **Marketing / Big Data** → customer Google Ads, property GA4, ad account Meta, hostname sito. Se il workspace ha OAuth collegato, compaiono **tendine** popolate dalle API. Persistenza: `tz_project_marketing_settings`.
- **Per workspace** (segreti): **Integrazioni** → **Big Data — accesso alle API** → pulsanti **Collega Google** / **Collega Meta** (OAuth) oppure, in **Avanzato**, incolla manuale (token Meta, JSON GA4, refresh Google). Persistenza: `tz_connector_configs` (`marketing_meta_ads`, `marketing_ga4`, `marketing_google_ads`).
- I connettori usano **prima** i valori workspace/progetto; le variabili sotto restano **fallback globali** da deploy (`src/config/env.ts`).

Variabili supportate da `be-followup-v3` (`src/config/env.ts`). Valori solo in secret manager / `.env` locale, mai in git.

## OAuth guidato (Integrazioni → Big Data)

### Redirect URI da registrare

| Provider | Callback backend (es. `PORT=8080`) |
|----------|-------------------------------------|
| Google   | `http://localhost:8080/v1/connectors/marketing-google/callback` |
| Meta     | `http://localhost:8080/v1/connectors/marketing-meta/callback` |

In **Google Cloud Console** (OAuth client Web): aggiungere il redirect sopra. Scopes usati dall’app: `https://www.googleapis.com/auth/adwords`, `https://www.googleapis.com/auth/analytics.readonly`.

In **Meta for Developers** → app → Facebook Login / OAuth: Valid OAuth Redirect URIs = stesso URL Meta della tabella.

Dopo il callback, il backend reindirizza il browser al frontend:

`{MARKETING_FRONTEND_REDIRECT_BASE o APP_PUBLIC_URL}/?section=integrations&tab=connettori&marketing_google=connected|error` (e analogo `marketing_meta=`).

### Variabili ambiente OAuth marketing

| Variabile | Descrizione |
|-----------|-------------|
| `GOOGLE_MARKETING_REDIRECT_URI` | In **produzione/staging** obbligatorio. In **dev** (`APP_ENV` non prod/staging): se assente, il backend usa `http://localhost:<PORT>/v1/connectors/marketing-google/callback` (`PORT` da `.env`, default 8080). Deve coincidere con Google Cloud Console. |
| `GOOGLE_MARKETING_CLIENT_ID` / `GOOGLE_MARKETING_CLIENT_SECRET` | Opzionali se già impostati `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`. |
| `META_MARKETING_REDIRECT_URI` | In **produzione/staging** obbligatorio. In **dev**, se assente: default `http://localhost:<PORT>/v1/connectors/marketing-meta/callback`. |
| `META_MARKETING_APP_ID` / `META_MARKETING_APP_SECRET` | Opzionali se si usano `META_APP_ID` / `META_APP_SECRET`. |
| `MARKETING_FRONTEND_REDIRECT_BASE` | Opzionale; default `APP_PUBLIC_URL` (senza slash finale). |
| `MARKETING_OAUTH_STATE_SECRET` | Opzionale; default `AUTH_JWT_SECRET` — usato per firmare il parametro `state` (HMAC-SHA256). |

### API (autenticate JWT)

- `GET /v1/workspaces/:workspaceId/connectors/marketing-google/oauth-url` → `{ url }` (solo `integrations.update`).
- `GET /v1/workspaces/:workspaceId/connectors/marketing-google/ads-customers` → `{ customers }` (refresh token workspace + `GOOGLE_ADS_DEVELOPER_TOKEN`).
- `GET /v1/workspaces/:workspaceId/connectors/marketing-google/ga4-properties` → `{ properties }` (stesso OAuth utente).
- `GET /v1/workspaces/:workspaceId/connectors/marketing-meta/oauth-url` → `{ url }`.
- `GET /v1/workspaces/:workspaceId/connectors/marketing-meta/ad-accounts` → `{ adAccounts }`.

## Google Ads + OAuth (stesso progetto Google Cloud)

1. Google Cloud: abilita **Google Ads API** e **Google Analytics API** (per scope Analytics). Se vedi **HTTP 404** con pagina HTML generica su `listAccessibleCustomers`, spesso è una **versione REST sunsettata**: il backend usa `https://googleads.googleapis.com/v23/...` (aggiornare il codice se Google ritira la major; [date sunset](https://developers.google.com/google-ads/api/docs/sunset-dates)).
2. OAuth client (Web) con redirect di callback marketing (tabella sopra).
3. **Flusso UI**: Integrazioni → Collega Google salva il refresh token in `marketing_google_ads`. Alternativa manuale: `GOOGLE_OAUTH_REFRESH_TOKEN` in env o POST connector.
4. Google Ads → **Tools → API Center** → developer token → `GOOGLE_ADS_DEVELOPER_TOKEN` (solo server, non da OAuth).
5. Customer da interrogare → per progetto in UI o `GOOGLE_ADS_CUSTOMER_ID` in env. Con MCC spesso serve `GOOGLE_ADS_LOGIN_CUSTOMER_ID` a livello progetto.

Il modulo `google-ads-insights.stub.ts` oggi verifica la presenza di token e restituisce un messaggio finché non viene integrato il client GAQL ufficiale.

## GA4 Data API (lettura)

**Percorso A — OAuth unificato con Google (Integrazioni):** stesso refresh di Ads; elenco property via Analytics Admin API (`accountSummaries`).

**Percorso B — Service account (Avanzato in Integrazioni):**

1. Service account su Google Cloud → chiave JSON.
2. GA4 Admin → accesso alla property per l’email della service account (Viewer/Analyst).
3. Salvataggio JSON in connector `marketing_ga4` oppure `GA4_SERVICE_ACCOUNT_JSON` in env.
4. `GA4_PROPERTY_ID` in env o ID per progetto in UI.

## Meta Marketing API

1. App Meta for Developers + Marketing API; redirect OAuth come sopra.
2. **Flusso UI**: Collega Meta → token long-lived salvato in `marketing_meta_ads`. Scope richiesto: `ads_read`, `public_profile`.
3. Alternativa manuale: token in **Avanzato** o env `META_ACCESS_TOKEN` / `META_APP_*`.

## FollowUp Platform API (Webflow)

È **separato** dalle chiavi sopra: chiave JSON in `PLATFORM_API_KEYS` (o chiavi DB) con scope:

- `platform.leads.create` → `POST /v1/platform/leads`
- `platform.propertyViews.create` → `POST /v1/platform/property-views` (eventi “listing visto” per Big Data)

Le chiavi create da UI con default includono anche `platform.propertyViews.create`.

Vedi anche [WEBFLOW_MARKETING_SNIPPET.md](./WEBFLOW_MARKETING_SNIPPET.md).

## Roadmap: altri connettori (stile Looker Studio)

Per uniformare Mailchimp, ActiveCampaign, Gmail, ecc.: stesso pattern **card → stato → CTA OAuth o API key → test connessione**, riusando `GET …/oauth-url` + callback pubblico + persistenza in `tz_connector_configs` / `tz_connector_credentials` (per utente come Outlook). Implementazione incrementale per priorità prodotto.
