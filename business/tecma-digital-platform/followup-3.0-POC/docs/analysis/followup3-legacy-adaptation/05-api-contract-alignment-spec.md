# Spec — allineamento contratti API Gateway (TECMA-BSS) ↔ Followup 3.0

## Scopo

Ridurre il rischio di integrazione “per tentativi” definendo **come** portare nel contratto TECMA-BSS le API Followup già progettate come `/v1/...`, mantenendo:

- compatibilità con endpoint legacy già pubblicati (`/login`, `/v2/...`)
- tracciabilità (OpenAPI + review + CI Spectral dove applicabile)

## Sorgenti di verità (e come usarle)

### 1) Raw OpenAPI (integrazioni API Gateway)

File (baseline repo architecture):

- `tecma/architecture/aws-api-gateway/api/TECMA-BSS/raw/TECMA Digital Platform - Dev-v1-oas30-apigateway.yaml`

Ruolo: **fonte primaria** per path, integrazioni `x-amazon-apigateway-integration`, mapping parametri, template.

### 2) Public swagger (documentazione/consumo)

File:

- `tecma/architecture/aws-api-gateway/api/TECMA-BSS/public/tecma-bss-swagger.yaml`

Ruolo: documentazione e SDK; **non sufficiente** da solo se diverge dal raw/runtime.

**Esempio concreto di drift da non ignorare:** nel public swagger, `/login` response schema mostra `accessToken` top-level, mentre il report interno descrive una forma `token.accessToken` (vedi `followup-3.0/docs/AUTH_AND_TECMA_BSS_API_REPORT.md` + confronto con adapter FE che legge `raw.token.accessToken`).

### 3) Addizioni Followup (merge proposto)

File:

- `followup-3.0/docs/openapi-tecma-bss-additions.yaml`

Contiene path proxy verso `be-followup-v3` via:

```12:16:tecma/business/tecma-digital-platform/followup-3.0/docs/openapi-tecma-bss-additions.yaml
      x-amazon-apigateway-integration:
        type: "http"
        httpMethod: "POST"
        uri: "http://${stageVariables.url}/v1/session/projects-by-email"
```

## Decisioni richieste (Gateway / Platform)

### D1 — Dove vivono le addizioni dopo il merge

Due repo osservati nella baseline:

- `tecma/architecture/aws-api-gateway` (canonico architettura)
- `tecma/business/tecma-digital-platform/aws-api-gateway` (repo “business” con lavoro su aggregazione TECMA-BSS)

**Decisione:** scegliere un solo “entrypoint” di MR per TECMA-BSS, l’altro repo deve importare/syncare o essere dichiarato deprecato.

### D2 — `stageVariables.url` per ambiente

Ogni integrazione HTTP usa `${stageVariables.url}`.

Requisiti:

- dev/stage/prod devono puntare a host Followup corretti
- TLS e allowlist egress dalla regione API Gateway verso il backend

### D3 — Autenticazione sui path proxy Followup

Mappa minima:

- path **public** Followup (es. health) possono restare senza auth JWT se già così nel POC
- path **session/projects-by-email** devono essere coerenti con la protezione prevista dal POC (`requireSessionTargetEmail`)

**Gap gateway:** l’OpenAPI additivo mostrato nel file non include ancora tutti i dettagli security standard TECMA moderni; in merge finale devono essere allineati alle regole Spectral del repo `architecture/aws-api-gateway` (ApiKey + Bearer dove richiesto).

## Piano di merge (procedure)

### Step 1 — Inventario collisioni path

Confrontare:

- path presenti in raw BSS
- path in `openapi-tecma-bss-additions.yaml`

Obiettivo: **zero collisioni** su `(method, path)` salvo override esplicito approvato.

### Step 2 — Merge meccanico + review umana mirata

Per ogni path additivo:

- verificare `httpMethod` (GET/POST) coerente col BE
- verificare mapping query/header (`requestParameters`)
- definire responses minime (`200/400/401/500`)

### Step 3 — Validazione locale

Dal repo `architecture/aws-api-gateway` eseguire:

- `yarn lint:domain <dominio>` (o equivalente repo-specifico)
- smoke: import OpenAPI in Postman (opzionale ma utile)

**Criterio di accettazione:** nessun errore Spectral “error” sui file toccati.

### Step 4 — Prove runtime (staging)

Matrice minima di test manuali/automatici:

- `POST /login` (BSS) su progetto noto
- `POST /v1/session/projects-by-email` (proxy) con token Followup *se* è lo scenario scelto
- `GET /v2/clients/project/{projectId}` con token BSS

## Allineamento “contratto FE” (non OpenAPI, ma impatta gateway)

### Adapter BSS (`fe-followup-v3`)

Il FE costruisce URL gateway per `/login` e URL “base /v1” per altre chiamate:

```8:14:tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/api/bssAuthAdapter.ts
const getGatewayBaseUrl = (): string => {
  const base = resolveApiBaseUrl().trim();
  if (base.endsWith("/v1")) return base.slice(0, -3);
  if (base.endsWith("/v1/")) return base.slice(0, -4);
  return base;
};
```

**Requisito:** la configurazione ambienti deve documentare chiaramente se `VITE_API_BASE_URL` include `/v1` o meno, perché influisce sul path effettivo di `getUserByJWT` (`/users/...` vs `/v1/users/...`).

## Strategia versioning

- modifiche **breaking** ai path Followup pubblicati in produzione ⇒ nuova versione `/v2/...` *nel mondo Followup* (non “rompere” client esistenti)
- per BSS: seguire policy del repo architecture (nuova versione dominio / nuovo file raw)

## Output attesi dal team Platform

- MR su OpenAPI raw con merge delle addizioni
- aggiornamento public swagger **coerente** con runtime (almeno per `/login`)
- environment mapping (`stageVariables.url`) per dev/stage/prod
- checklist Postman minima (anche solo collection locale nel repo, se policy lo consente)

## Rischi

- **Drift** tra public/raw/runtime
- **Security**: proxy HTTP verso backend Followup espone superficie nuova (authz network + authz applicativa)
- **Doppioni** tra repo architecture vs business aws-api-gateway

## Contract testing e CI (gate permanenti)

- **Spectral**: `yarn lint:domain` sul dominio TECMA-BSS dopo ogni merge che tocca path Followup o proxy; errori = blocco release (allineato a regole workspace `tecma-path-versioning`, security schemes).
- **Newman / governance collection**: eseguire la collection indicata nel repo `aws-api-gateway` su ambiente staging quando cambiano integrazioni `x-amazon-apigateway-integration` verso `be-followup-v3` (vedi anche `07` §9 checklist gateway).
- **Contract FE↔gateway**: test smoke che verificano almeno `getGatewayBaseUrl` + una chiamata `getUserByJWT` con URL risolto come in `fe-followup-v3` (evita regressioni `/v1` doppio).
- **Tracciabilità**: per ogni nuovo path in OpenAPI, aggiungere riga in `07` §9b con ID test Newman o ID suite Playwright che lo copre.
