# Wave 8-9 Delivery (Product Backbone + Platform API)

Questa wave implementa la base operativa per passare dal solo hardening a crescita prodotto/scala.

## 1) Realtime Backbone

- Nuovo **event envelope** unificato:
  - `eventType`
  - `entityId`
  - `workspaceId`
  - `projectId`
  - `actorId`
  - `timestamp`
  - `payloadVersion`
  - `payload`
- Nuovo stream SSE: `GET /v1/realtime/stream`
  - Query: `workspaceId` (required), `projectId` (optional), `eventTypes` (optional CSV), `accessToken` (optional)
  - Supporta anche `Authorization: Bearer <jwt>`
- Emissione realtime collegata a:
  - `emitDomainEvent(...)` (eventi dominio)
  - `createNotification(...)` (evento `notification.created`)

## 2) Reporting Nativo KPI

- Esteso `runReport` con `reportType = kpi_summary`
- 5 KPI minimi restituiti:
  - `pipeline_funnel`
  - `conversion_rate`
  - `agent_performance`
  - `pipeline_value`
  - `apartments_by_status`
- FE aggiornato: pagina Report supporta il tipo `kpi_summary`.

## 3) Platform API Boundary (`/v1/platform/*`)

- Nuove endpoint:
  - `GET /v1/platform/capabilities`
  - `POST /v1/platform/listings/query`
  - `POST /v1/platform/reports/kpi-summary`
- Sicurezza:
  - API key obbligatoria (`x-api-key`, fallback `Authorization: Bearer <api-key>`)
  - Rate limit dedicato per API key
  - Scope tenant-aware (`workspaceId`/`projectIds`) derivato da configurazione API key
  - Scope per endpoint (`platform.capabilities.read`, `platform.listings.read`, `platform.reports.read`)
  - Quota giornaliera opzionale per key (`quotaPerDay`) con enforcement runtime

### Config env

- `PLATFORM_API_KEYS`: JSON object, esempio:
  ```json
  {
    "key_live_partner_1": {
      "workspaceId": "ws_prod_1",
      "projectIds": ["proj_a", "proj_b"],
      "label": "partner-site"
    }
  }
  ```
- `PLATFORM_RATE_LIMIT_PER_MIN`: default `120`.

## 4) SDK Typed Client (bozza iniziale)

- Aggiunto client typed riusabile:
  - `be-followup-v3/src/platform/followup-platform-client.ts`
- Metodi:
  - `getCapabilities()`
  - `queryListings(...)`
  - `getKpiSummary(...)`

## 5) Wave 10 Kickstart - Customer Portal MVP

- Nuovi endpoint:
  - `POST /v1/portal/magic-links` (interno, JWT richiesto)
  - `POST /v1/portal/auth/exchange` (pubblico)
  - `POST /v1/portal/overview` (pubblico)
- FE:
  - nuova route pubblica `/portal?token=...`
  - pagina `CustomerPortalPage` con:
    - stato pratiche (deals)
    - elenco documenti (quote + documenti manuali)
