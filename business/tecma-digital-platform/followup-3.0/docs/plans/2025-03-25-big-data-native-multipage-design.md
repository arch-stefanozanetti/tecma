# Big Data nativo multipagina e connessioni marketing per progetto

## Obiettivo

- UI Big Data con tab native (Panoramica, Google Ads, Meta, GA4, Funnel CRM, Listings) filtrate per `projectId`.
- Identificativi marketing non sensibili per progetto (`tz_project_marketing_settings`).
- Segreti (token, service account JSON, OAuth refresh) per workspace in `tz_connector_configs` con `connectorId` dedicati.
- Endpoint Big Data con `section` e cache per `(workspaceId, projectId, dateRange, attributionModel, section)`.
- Eventi first-party `property_view` via Platform API per “appartamenti più visti” oltre alle trattative.

## Collezioni Mongo

| Collezione | Contenuto |
|------------|-----------|
| `tz_project_marketing_settings` | `projectId`, `googleAdsCustomerId`, `googleAdsLoginCustomerId`, `ga4PropertyId`, `metaAdAccountId`, `siteHostname`, `updatedAt` |
| `tz_connector_configs` | `workspaceId`, `connectorId` ∈ `marketing_meta_ads`, `marketing_ga4`, `marketing_google_ads`, `config` (segreti) |
| `tz_property_view_events` | `workspaceId`, `projectId`, `listingId?`, `apartmentId?`, `path?`, `occurredAt`, `createdAt` |
| `tz_bigdata_cache` | chiave estesa con `section` |

## API

- `GET/PUT /v1/projects/:projectId/marketing-settings?workspaceId=` — `SETTINGS_READ` / `SETTINGS_UPDATE`.
- `GET/POST/DELETE /v1/workspaces/:workspaceId/connectors/marketing-{meta-ads|ga4|google-ads}/config` — `INTEGRATIONS_*` + entitlement integrations.
- `GET /v1/bigdata/projects/:projectId?section=overview|ads|meta|ga4|funnel|listings|full` — `REPORTS_READ`; `full` = snapshot completo (default retrocompatibile).
- `POST /v1/platform/property-views` — scope `platform.propertyViews.create`.

## Metriche funnel “impression → vendita”

- Upstream: dati da connettori (quando cablati); finché stub, valori assenti o zero con nota in `reconciliationNotes`.
- Downstream: lead / appuntamenti / proposte / vendite da CRM (definizioni invariati rispetto a Big Data v1).
- UI: etichettare sempre la sorgente (Ads vs GA4 vs CRM).

## Sicurezza

- Risposte GET marketing connectors: solo campi mascherati; mai eco di segreti pieni.
- Validazione `projectId` su property-views rispetto ai `projectIds` della API key.
