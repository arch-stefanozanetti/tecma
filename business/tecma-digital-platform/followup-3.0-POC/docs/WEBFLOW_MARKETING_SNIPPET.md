# Webflow Recommerce: snippet attribuzione + lead

## 1. Site-wide (before `</body>`)

- Leggere `gclid`, `fbclid`, `utm_*` da `window.location.search`.
- Se presente almeno un valore, salvare in `localStorage` (es. chiave `fu_mkt`) un JSON con timestamp.
- Opzionale: cookie first-party di backup (stesso payload, max-age ~30 giorni).

## 2. Pagina scheda appartamento

- Inviare a GA4 un evento custom, es. `apt_page_view`, con parametro `apt_code` dal query param `apt` (es. `A5.4`).
- **Visualizzazioni (Big Data “listing più visti”)**: su load della scheda, `POST /v1/platform/property-views` con la stessa `x-api-key` e scope `platform.propertyViews.create`. Body es.: `{ "projectId": "<id>", "listingId": "<slug o id CMS>", "apartmentId": "<id se noto>", "path": "<pathname>" }`. `occurredAt` opzionale (ISO); default server time.
- All’invio form (richiesta info / preventivo):
  - Leggere il blob da `localStorage`.
  - `POST` al backend FollowUp: `POST /v1/platform/leads` con header `x-api-key: <platform key>`.
  - Body minimo:
    - `projectId`, `firstName`, `lastName`, `email` (opzionale se policy lo consente), `phone` (opzionale)
    - `apartmentCode` o `apartmentId` se noto
    - `marketingAttribution: { touch: { ... campi UTM/gclid/fbclid/landingPath/capturedAt } }`

## 3. CORS

- Il browser chiamerà il dominio API FollowUp: configurare CORS sul gateway/backend per l’origine del sito Webflow.

## 4. Scopes API key

- Nella mappa `PLATFORM_API_KEYS` includere `platform.leads.create` e, per gli eventi scheda, `platform.propertyViews.create` (default per le nuove chiavi create da UI).
