# Runbook: API marketing (Google Ads, GA4, Meta)

Variabili supportate da `be-followup-v3` (`src/config/env.ts`). Valori solo in secret manager / `.env` locale, mai in git.

## Google Ads + OAuth (stesso progetto Google Cloud)

1. Google Cloud: abilita **Google Ads API**.
2. OAuth client (Desktop o Web) → `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
3. Ottieni **refresh token** per un utente con accesso agli account Ads → `GOOGLE_OAUTH_REFRESH_TOKEN`.
4. Google Ads → **Tools → API Center** → developer token → `GOOGLE_ADS_DEVELOPER_TOKEN`.
5. Customer da interrogare → `GOOGLE_ADS_CUSTOMER_ID` (es. `1234567890` senza trattini). Con MCC spesso serve anche `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

Il modulo `google-ads-insights.stub.ts` oggi verifica la presenza di token e restituisce un messaggio finché non viene integrato il client GAQL ufficiale.

## GA4 Data API (lettura)

1. Service account su Google Cloud → chiave JSON.
2. GA4 Admin → accesso alla property per l’email della service account (Viewer/Analyst).
3. `GA4_SERVICE_ACCOUNT_JSON`: contenuto JSON **o** base64 (come preferite in deploy; adattare il loader quando si integra l’SDK).
4. `GA4_PROPERTY_ID`: ID numerico della property.

## Meta Marketing API

1. App Meta for Developers + prodotto Marketing API.
2. Business Manager: collega ad account e permessi `ads_read`.
3. `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN` (long-lived / system user).
4. `META_AD_ACCOUNT_ID`: es. `act_123456789`.

## FollowUp Platform API (Webflow)

È **separato** dalle chiavi sopra: chiave JSON in `PLATFORM_API_KEYS` con scope `platform.leads.create` per `POST /v1/platform/leads`.

Vedi anche [WEBFLOW_MARKETING_SNIPPET.md](./WEBFLOW_MARKETING_SNIPPET.md).
