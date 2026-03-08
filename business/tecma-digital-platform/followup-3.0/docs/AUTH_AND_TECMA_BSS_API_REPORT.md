# Auth e stato API TECMA-BSS (aws-api-gateway)

Report sullo stato delle API in **aws-api-gateway** (TECMA-BSS, non INT) e su come usarle per l’auth in Followup 3.0.

---

## 1. A che punto sono le API TECMA-BSS

### 1.1 Contenuto attuale (raw)

Nel file **api/TECMA-BSS/raw/TECMA Digital Platform - Dev-v1-oas30-apigateway.yaml** sono definiti questi path:

| Path | Metodo | Backend (stageVariables.url) | Note |
|------|--------|------------------------------|------|
| `/login` | POST | `/v1/auth/loginByProjectBP` | Login con email, password, **project_id** |
| `/v1/auth/refresh-token` | POST | `/v1/auth/refresh-token` | Refresh token |
| `/v1/auth/gateway-test` | POST | `/v1/auth/gateway-test` | Test gateway |
| `/v1/users/getUserByJWT` | POST | `/v1/users/getUserByJWT` | Utente da JWT (equivalente "me") |
| `/v2/movements/project/{projectId}` | GET | idem | |
| `/v2/projects/{projectId}` | GET | idem | |
| `/v2/projects/hostname/{host}` | GET | idem | |
| `/v1/spaces/...` | GET | idem | |
| `/v2/clients/project/{projectId}` | GET | idem | |
| `/v2/quotes/project/{projectId}` | GET | idem | |
| `/v1/document/...`, `/v1/request/...`, `/v1/clientDocument/...` | vari | idem | |

**Auth esistenti (fatte dai colleghi):**

- **POST /login**  
  Body: `email`, `password`, `project_id` (tutti obbligatori).  
  Il gateway chiama il backend `loginByProjectBP` e risponde con un template Velocity che mappa la risposta in:  
  `token: { tokenType, accessToken, refreshToken, expiresIn }`,  
  `user: { firstName, lastName, email, role, TwoFA, project_ids, language, createdOn, updatedOn, id }`.

- **POST /v1/auth/refresh-token**  
  Integrazione HTTP verso il backend omonimo; nessun request/response template nel raw.

- **POST /v1/users/getUserByJWT**  
  Header `Authorization` inoltrato al backend; usabile come “me” (utente corrente da JWT).

Quindi le API auth **ci sono già** e sono pronte per essere usate dal gateway (stesso pattern `stageVariables.url`).

---

## 2. Qualità e cosa manca (TECMA-BSS vs lavoro AI in followup)

### 2.1 Test

- **aws-api-gateway (TECMA-BSS):**  
  **Nessun test automatico.** Nel repo non ci sono Jest/Vitest/Mocha, né file `*.test.*` / `*.spec.*` per le definizioni OpenAPI o per il comportamento degli endpoint.  
  La verifica è affidata a Postman (solo per alcune INT) e all’uso manuale.

- **be-followup-v3 (lavoro AI):**  
  Vitest + test su handler (`asyncHandler`), `HttpError`, e su route (`/v1/health`, `/v1/openapi.json`, `/v1/session/projects-by-email` con body invalido).  
  Obiettivo esplicito: ogni nuova logica con test; niente “codice non testato”.

**Conclusione:** sulle API BSS i colleghi non hanno introdotto test; l’AI in followup sì, con standard più alto su questo punto.

### 2.2 DRY e struttura

- **TECMA-BSS (raw):**  
  Ogni path ha la sua integrazione ripetuta (stesso schema: `uri`, `responses`, `requestParameters`).  
  Non c’è un “modulo” condiviso di integrazione; è lo standard di OpenAPI + API Gateway (ripetizione per path).  
  Nessun codice applicativo nel repo: solo YAML, quindi il concetto DRY si applica poco qui.

- **be-followup-v3:**  
  Route handler unificati con `handleAsync` e `sendError`; niente try/catch duplicato; errori HTTP con `HttpError` e statusCode.  
  Rispetto al backend, l’AI ha applicato DRY in modo esplicito.

### 2.3 Documentazione e coerenza

- **TECMA-BSS:**  
  - **Public** (`tecma-bss-swagger.yaml`): descrizioni, esempi, tag Authentication, schema Token/User.  
  - **Raw**: integrazioni AWS e template Velocity per `/login`; path auth coerenti con il public.  
  - **SWAGGER-TEMPLATE/TecmaAuthTemplate.yaml**: template auth riutilizzabile (required: email, password, project_id; response token + user).  
  C’è documentazione utile e un template auth chiaro.

- **Followup:**  
  OpenAPI in `be-followup-v3` (`/v1/openapi.json`) e addizioni in `docs/openapi-tecma-bss-additions.yaml` per il merge in BSS.  
  Allineamento con lo stile BSS (path generici, integrazione `stageVariables.url`).

### 2.4 Cosa manca in TECMA-BSS (rispetto a “perfetto e testato”)

1. **Test automatici** su contratti e/o integrazioni (es. validazione OpenAPI, smoke su path critici).
2. **Script di aggregazione** OpenAPI: in `api/tools/scripts/aggregate-openapi.sh` c’è solo un TODO, nessuna aggregazione reale.
3. **Postman/collezioni** solo per INT (ChorusLife, Immobiliare), non per TECMA-BSS (quindi niente collezione ufficiale per login/refresh/getUserByJWT).
4. **README** con flusso chiaro “import/export per ambienti” (dev, test, prod) ancora da descrivere (TODO in README).

In sintesi: le API BSS (inclusa auth) **sono definite e utilizzabili**, ma senza test automatici e con qualche buco operativo (script, Postman BSS, doc ambienti).

---

## 3. Differenze auth: BSS vs Followup

| Aspetto | TECMA-BSS (gateway) | be-followup-v3 attuale |
|---------|---------------------|--------------------------|
| Login | POST `/login` con **email, password, project_id** | POST `/v1/auth/login` con **email, password** |
| Risposta login | `token.accessToken`, `token.refreshToken`, `token.expiresIn`, `user.*` (firstName, lastName, role, TwoFA, project_ids, …) | `accessToken`, `user: { id, email, role, isAdmin }` |
| “Me” | POST `/v1/users/getUserByJWT` (Authorization) | GET `/v1/auth/me` (Authorization) |
| Refresh | POST `/v1/auth/refresh-token` | Non esposto (JWT con scadenza) |
| SSO | Non presente in BSS | POST `/v1/auth/sso-exchange` (ssoJwt) |

Quindi:

- **Usare “gli endpoint già creati” in aws-api-gateway** significa: usare **/login**, **/v1/auth/refresh-token** e **/v1/users/getUserByJWT** quando il frontend chiama il gateway (es. api.tecmasolutions.com).
- Il **login BSS richiede `project_id`**; Followup oggi fa login **senza** progetto e poi chiama `session/projects-by-email` e fa scegliere i progetti. Quindi o si adatta il flusso (es. prima progetto, poi login BSS) o si tiene un login “senza progetto” da qualche parte (es. nostro backend dietro un path aggiuntivo in BSS, o solo in locale).

---

## 4. Cosa fare per l’auth (usando il più possibile le API BSS)

### 4.1 Quando il frontend parla al gateway (api.tecmasolutions.com)

- **Login con progetto noto**  
  Usare **POST /login** (BSS) con `email`, `password`, `project_id`.  
  Nel frontend mappare la risposta BSS (`token`, `user`) allo stato dell’app (es. salvare `token.accessToken` come Bearer, e da `user` derivare id, email, role, isAdmin se serve).

- **“Chi sono io” (me)**  
  Usare **POST /v1/users/getUserByJWT** con header `Authorization: Bearer <accessToken>`.  
  Mappare la risposta BSS allo stesso formato che usa oggi il FE (id, email, role, isAdmin) se vuoi mantenere il resto dell’app invariato.

- **Refresh token**  
  Usare **POST /v1/auth/refresh-token** (body/header come si aspetta il backend BSS) e aggiornare l’access token lato client.

Così **non** servono nuovi endpoint auth nel gateway: si riusano quelli già definiti in TECMA-BSS.

### 4.2 Flusso Followup “login senza progetto” (progetti per email)

- **Opzione A – Solo BSS**  
  Cambiare flusso: l’utente sceglie prima un progetto (o ne ha uno default), poi si chiama POST /login con email, password, project_id.  
  Per “lista progetti per email” andrebbe esposto in BSS un endpoint tipo “projects-by-email” (se i colleghi lo forniscono) o un altro meccanismo BSS.

- **Opzione B – Ibrido**  
  In **locale / senza gateway**: continuare a usare be-followup-v3 (POST `/v1/auth/login` senza project_id, GET/POST session/preferences, POST session/projects-by-email).  
  Quando l’app è servita via **api.tecmasolutions.com**: usare per l’auth gli endpoint BSS (/login, getUserByJWT, refresh-token) e, se il backend BSS lo espone, un endpoint “projects-by-email” o equivalente; altrimenti tenere quel path sul nostro backend e registrarlo in BSS come addizione (come in `openapi-tecma-bss-additions.yaml`).

### 4.3 SSO (sso-exchange)

- **BSS** non espone un path “sso-exchange” nel raw.  
- Se l’SSO è richiesto solo in contesto Followup/BP, si può lasciare **solo nel nostro backend** e aggiungere in TECMA-BSS un path (es. POST `/v1/auth/sso-exchange`) che punta al nostro backend, come nelle addizioni OpenAPI già proposte.

---

## 5. Riepilogo

- **Stato API TECMA-BSS:**  
  Le API (inclusa auth) **sono definite** in raw e documentate in public; endpoint già creati e utilizzabili: `/login`, `/v1/auth/refresh-token`, `/v1/users/getUserByJWT`.  
  Manca: test automatici, script di aggregazione OpenAPI, Postman per BSS, doc completa sugli ambienti.

- **Confronto con il lavoro AI:**  
  L’AI in followup ha introdotto test, DRY nei handler, errori HTTP unificati e documentazione chiara; i colleghi hanno curato documentazione e contratti OpenAPI ma non i test.

- **Auth:**  
  Per “usare gli endpoint già creati” conviene usare **/login**, **/v1/auth/refresh-token** e **/v1/users/getUserByJWT** quando il FE chiama il gateway; adattare il flusso (login con project_id) o usare un approccio ibrido (BSS in prod, nostro backend in locale / per session e SSO).  
  Per SSO e, se serve, “projects-by-email”, si possono aggiungere in TECMA-BSS i path che puntano al backend Followup, come nelle addizioni già descritte.
