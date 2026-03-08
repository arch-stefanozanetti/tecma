# Piano: Unificazione API aws-api-gateway e Followup 3.0

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralizzare tutte le API (BSS esistenti + Followup) in aws-api-gateway con comportamento univoco, e fornire test automatici, Postman, documentazione OpenAPI completa e una pagina di documentazione chiara; adattare il frontend Followup 3.0 per usare il gateway.

**Architecture:** (1) Lo spec unico vive in aws-api-gateway: raw per API Gateway (integrazioni AWS), public per documentazione (OpenAPI 3 con descrizioni/schemi). (2) Le addizioni Followup (followup-3.0/docs/openapi-tecma-bss-additions.yaml) vengono mergiate nel raw/public TECMA-BSS. (3) I path BSS già presenti vengono migliorati (descrizioni, request/response schema dove mancano). (4) In aws-api-gateway si aggiungono test (validazione OpenAPI, opzionale Postman/Newman), una collezione Postman per TECMA-BSS e uno script di aggregazione OpenAPI. (5) Il developer portal espone la documentazione aggiornata (Swagger UI su spec public). (6) Il frontend Followup usa VITE_API_BASE_URL per puntare al gateway per ambiente (dev-1, demo, prod).

**Tech Stack:** OpenAPI 3.0, AWS API Gateway (stageVariables.url), Node/npm (Vitest o Jest per test spec), Postman/Newman, Swagger UI (developer portal), Vite (fe-followup-v3), be-followup-v3 (Express).

---

## Fase 1: aws-api-gateway – Merge addizioni Followup e spec unico

### Task 1.1: Copiare le addizioni Followup nel repo aws-api-gateway

**Files:**
- Read: `followup-3.0/docs/openapi-tecma-bss-additions.yaml`
- Create: `aws-api-gateway/api/TECMA-BSS/additions-followup.yaml` (copia del contenuto)

**Step 1:** Copiare il file delle addizioni nel repo gateway come riferimento interno (per merge manuale o script).

**Comando:**
```bash
cp "followup-3.0/docs/openapi-tecma-bss-additions.yaml" "aws-api-gateway/api/TECMA-BSS/additions-followup.yaml"
```

**Step 2: Commit**
```bash
cd aws-api-gateway && git add api/TECMA-BSS/additions-followup.yaml && git commit -m "chore: add Followup API additions for merge into TECMA-BSS"
```

---

### Task 1.2: Merge dei path Followup nel raw TECMA-BSS (senza sovrascrivere path esistenti)

**Files:**
- Modify: `aws-api-gateway/api/TECMA-BSS/raw/TECMA Digital Platform - Dev-v1-oas30-apigateway.yaml`
- Read: `aws-api-gateway/api/TECMA-BSS/additions-followup.yaml`

**Step 1:** Aprire il raw e identificare la sezione `paths:`. Aggiungere tutti i path da additions-followup.yaml che **non** sono già presenti nel raw. Path già presenti nel raw BSS: `/login`, `/v1/auth/refresh-token`, `/v1/auth/gateway-test`, `/v1/users/getUserByJWT`, `/v2/movements/...`, `/v2/projects/...`, `/v1/spaces/...`, `/v2/clients/...`, `/v2/quotes/...`, `/v1/document/...`, `/v1/request/...`, `/v1/clientDocument/...`. Tutti i path sotto `paths:` in additions-followup (es. `/v1/health`, `/v1/session/projects-by-email`, `/v1/auth/login`, `/v1/auth/me`, `/v1/calendar/...`, ecc.) vanno aggiunti al raw (stesso formato YAML, stessa indentazione).

**Step 2:** Verificare che le integrazioni usino `uri: "http://${stageVariables.url}/v1/..."` e che non ci siano duplicati di chiave `paths`.

**Step 3: Commit**
```bash
git add "api/TECMA-BSS/raw/TECMA Digital Platform - Dev-v1-oas30-apigateway.yaml"
git commit -m "feat(TECMA-BSS): merge Followup API paths into raw spec"
```

---

### Task 1.3: Aggiornare il public tecma-bss-swagger con i path Followup (e allineare server URL)

**Files:**
- Modify: `aws-api-gateway/api/TECMA-BSS/public/tecma-bss-swagger.yaml`
- Read: `api/TECMA-BSS/additions-followup.yaml` (solo paths + summary/description; niente x-amazon-apigateway-integration nel public)

**Step 1:** Aggiungere nel public i path Followup con descrizioni e, dove possibile, requestBody/response schema (senza estensioni AWS). Allineare `servers` se necessario (es. api.tecmasolutions.com per ambiente).

**Step 2: Commit**
```bash
git add api/TECMA-BSS/public/tecma-bss-swagger.yaml
git commit -m "docs(TECMA-BSS): add Followup paths to public swagger"
```

---

## Fase 2: aws-api-gateway – Migliorare le API esistenti (colleghi)

### Task 2.1: Aggiungere descrizioni e tag ai path BSS esistenti nel public

**Files:**
- Modify: `aws-api-gateway/api/TECMA-BSS/public/tecma-bss-swagger.yaml`

**Step 1:** Per ogni path esistente (login, getUserByJWT, refresh-token, v2/projects, v2/clients, v2/quotes, v1/spaces, v1/document, v1/request, v1/clientDocument): aggiungere `summary` e `description` brevi se mancano; assegnare `tags` coerenti (es. "Authentication", "Projects", "Clients", "Quotes", "Spaces", "Documents", "Requests").

**Step 2: Commit**
```bash
git add api/TECMA-BSS/public/tecma-bss-swagger.yaml
git commit -m "docs(TECMA-BSS): add descriptions and tags to existing BSS paths"
```

---

### Task 2.2: Aggiungere request/response schema dove possibile (public)

**Files:**
- Modify: `aws-api-gateway/api/TECMA-BSS/public/tecma-bss-swagger.yaml`

**Step 1:** Per `/login`: assicurarsi che requestBody abbia schema con email, password, project_id (già presente nel template). Per le response 200, aggiungere `content.application/json.schema` con riferimenti a componenti Token/User se già definiti.

**Step 2:** Per gli altri path BSS con body (POST/PUT), aggiungere schema minimi in `components/schemas` e riferirli da requestBody/responses dove mancano.

**Step 3: Commit**
```bash
git add api/TECMA-BSS/public/tecma-bss-swagger.yaml
git commit -m "docs(TECMA-BSS): add request/response schemas for BSS endpoints"
```

---

## Fase 3: aws-api-gateway – Test, Postman, aggregazione

### Task 3.1: Setup test OpenAPI (validazione spec) in aws-api-gateway

**Files:**
- Create: `aws-api-gateway/package.json` (se non esiste; altrimenti modificare)
- Create: `aws-api-gateway/api/TECMA-BSS/openapi.test.js` (o .ts con vitest)

**Step 1:** In `aws-api-gateway` inizializzare npm se manca: `npm init -y`. Aggiungere dipendenze: `@apidevtools/swagger-parser` (o `swagger2openapi` + validazione) o `openapi-typescript` solo per build. Per test di validazione: `npm install -D vitest` (o jest) e uno strumento che carichi e validi YAML OpenAPI (es. swagger-parser che valida OpenAPI 3).

**Step 2:** Creare uno script/test che: (1) carichi `api/TECMA-BSS/public/tecma-bss-swagger.yaml`, (2) validi che sia OpenAPI 3 valido (nessun errore di parsing/schema). Comando: `npm run test` esegue il test.

**Esempio (Node):**
```js
// api/TECMA-BSS/openapi.validate.js
const SwaggerParser = require('@apidevtools/swagger-parser');
const path = require('path');
async function validate() {
  const file = path.join(__dirname, 'public', 'tecma-bss-swagger.yaml');
  await SwaggerParser.validate(file);
  console.log('OpenAPI spec valid');
}
validate().catch(err => { console.error(err); process.exit(1); });
```

**Step 3:** Aggiungere in package.json: `"test": "node api/TECMA-BSS/openapi.validate.js"` (o con vitest se preferisci). Eseguire `npm run test` e verificare che passi.

**Step 4: Commit**
```bash
git add package.json api/TECMA-BSS/openapi.validate.js
git commit -m "test(TECMA-BSS): add OpenAPI spec validation"
```

---

### Task 3.2: Collezione Postman per TECMA-BSS

**Files:**
- Create: `aws-api-gateway/api/TECMA-BSS/postman/TECMA-BSS.postman_collection.json`
- Create: `aws-api-gateway/api/TECMA-BSS/postman/TECMA-BSS.postman_environment.json` (opzionale, variabili BASEURL, BEARER_TOKEN, PROJECT_ID)

**Step 1:** Creare una collezione Postman con: (1) POST /login (body: email, password, project_id); script test che salva token in variabile. (2) POST /v1/auth/refresh-token. (3) POST /v1/users/getUserByJWT (header Authorization). (4) GET /v1/health (se esposto). (5) Altri path critici BSS (es. GET /v2/projects/{projectId}) e almeno un path Followup (es. POST /v1/session/projects-by-email). Usare variabili {{BASEURL}}, {{BEARER_TOKEN}}.

**Step 2:** Documentare nel README che la collezione è in `api/TECMA-BSS/postman/` e come importarla.

**Step 3: Commit**
```bash
git add api/TECMA-BSS/postman/ README.md
git commit -m "feat(TECMA-BSS): add Postman collection and environment"
```

---

### Task 3.3: Script di aggregazione OpenAPI

**Files:**
- Modify: `aws-api-gateway/api/tools/scripts/aggregate-openapi.sh`
- Read: `api/TECMA-BSS/public/tecma-bss-swagger.yaml`

**Step 1:** Implementare lo script che: (1) copia o merge il file public TECMA-BSS in un output (es. `api/tools/out/tecma-bss-full.yaml`) eventualmente iniettando `servers` per ambiente. Per ora può essere una semplice copia con possibile sostituzione di variabili (es. server URL). Obiettivo: un unico file OpenAPI “full” usabile per import in gateway o per il developer portal.

**Step 2:** Aggiungere in README una riga su come eseguire lo script e dove si trova l’output.

**Step 3: Commit**
```bash
git add api/tools/scripts/aggregate-openapi.sh README.md
git commit -m "chore: implement OpenAPI aggregation script for TECMA-BSS"
```

---

## Fase 4: Developer portal – Pagina documentazione API

### Task 4.1: Usare lo spec TECMA-BSS public nel developer portal

**Files:**
- Modify: `aws-api-gateway/developers.tecmasolutions.com/S3-tecma-apigateway-swagger/swagger-initializer.js` (o equivalente)
- Read: `developers.tecmasolutions.com/S3-tecma-apigateway-swagger/swagger.yaml` e `api/TECMA-BSS/public/tecma-bss-swagger.yaml`

**Step 1:** Il portal oggi carica `./swagger.json`. Decidere: (1) sostituire swagger.json con l’export dello spec public TECMA-BSS (aggiornato), così la pagina documenta tutte le API BSS + Followup; oppure (2) aggiungere un selettore per più spec (BSS, ChorusLife, Immobiliare). Per “una pagina in cui le api sono documentate bene” la soluzione minima è: assicurarsi che il file servito dal portal (swagger.json o swagger.yaml) sia generato da `api/TECMA-BSS/public/tecma-bss-swagger.yaml` (es. tramite aggregate-openapi.sh o copy in CI).

**Step 2:** Documentare nel README del repo che il contenuto del developer portal (S3-tecma-apigateway-swagger) va aggiornato dallo spec in api/TECMA-BSS/public/ (o dall’output di aggregate-openapi.sh).

**Step 3: Commit**
```bash
git add developers.tecmasolutions.com/ README.md
git commit -m "docs: wire developer portal to TECMA-BSS public spec"
```

---

## Fase 5: Frontend Followup 3.0 – Adattamento al gateway

### Task 5.1: Documentare e configurare VITE_API_BASE_URL per ambienti

**Files:**
- Modify: `followup-3.0/fe-followup-v3/.env.example`
- Modify: `followup-3.0/README.md` (o fe-followup-v3/README se esiste)

**Step 1:** In `.env.example` aggiungere commenti per `VITE_API_BASE_URL` con esempi: locale `http://localhost:5060/v1`, dev-1 gateway `https://api.tecmasolutions.com/biz-tecma-dev1/v1`, demo `https://api.tecmasolutions.com/biz-tecma-demo-prod/v1`, prod `https://api.tecmasolutions.com/biz-tecma-prod/v1` (o i path reali concordati). Il FE usa già `API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/v1"` e chiama `fetch(API_BASE_URL + path)` con path tipo `/auth/login`, quindi la base deve terminare con `/v1` o la path deve includere `/v1`; attualmente in http.ts è `API_BASE_URL + path` con path `/session/...`, quindi API_BASE_URL deve essere ad es. `https://api.../v1` (senza trailing slash) e i path in followupapi sono `/auth/login` → URL finale `https://api.../v1/auth/login`. OK.

**Step 2:** Nel README documentare che per usare il gateway l’utente imposta VITE_API_BASE_URL all’URL base del gateway incluso `/v1`.

**Step 3: Commit**
```bash
cd followup-3.0/fe-followup-v3 && git add .env.example
cd ../.. && git add followup-3.0/README.md
git commit -m "docs(followup): document VITE_API_BASE_URL for gateway environments"
```

---

### Task 5.2: Adattare il client HTTP per base URL con gateway (CORS e errori)

**Files:**
- Modify: `followup-3.0/fe-followup-v3/src/api/http.ts`

**Step 1:** Verificare che i messaggi di errore (es. “backend be-followup-v3 sia attivo su localhost:5060”) non siano hardcoded quando si usa il gateway. Usare un messaggio generico tipo “Verifica che le API siano raggiungibili e che l’ambiente (VITE_API_BASE_URL) sia corretto” quando `API_BASE_URL` non è localhost.

**Step 2: Commit**
```bash
git add followup-3.0/fe-followup-v3/src/api/http.ts
git commit -m "fix(fe-followup): generic API error message when using gateway"
```

---

### Task 5.3: (Opzionale) Adapter auth per BSS se si usa /login e getUserByJWT del gateway

**Files:**
- Read: `followup-3.0/docs/AUTH_AND_TECMA_BSS_API_REPORT.md`
- Modify: `followup-3.0/fe-followup-v3/src/api/followupapi.ts` e eventuale `src/core/auth/LoginPage.tsx` / `ProjectAccessPage.tsx`

**Step 1:** Se si decide di usare dal FE gli endpoint BSS già in gateway (POST /login con project_id, POST /v1/users/getUserByJWT): introdurre un adapter che chiami il gateway e mappi la risposta BSS (token.accessToken, user con firstName, lastName, project_ids…) allo stato atteso dall’app (accessToken, user con id, email, role, isAdmin). Aggiungere una variabile d’ambiente (es. VITE_USE_BSS_AUTH=true) per abilitare questo flusso e mantenere il flusso attuale (be-followup-v3 /v1/auth/login e /v1/auth/me) quando si lavora in locale.

**Step 2:** Test manuali: login con gateway vs login con backend locale.

**Step 3: Commit**
```bash
git add followup-3.0/fe-followup-v3/src/api/followupapi.ts followup-3.0/fe-followup-v3/src/core/auth/
git commit -m "feat(fe-followup): optional BSS auth adapter for gateway"
```

---

## Riepilogo dipendenze

- Fase 1: nessuna (solo merge file).
- Fase 2: dopo Fase 1 (il public deve contenere già i path Followup).
- Fase 3: dopo Fase 1–2 (spec public completo per validazione e Postman).
- Fase 4: dopo Fase 3 (aggregation opzionale per portal).
- Fase 5: indipendente; può essere fatta in parallelo dopo Task 1.2 (gateway deve esporre i path).

## Verifica finale

- [ ] In aws-api-gateway: `npm run test` passa (validazione OpenAPI).
- [ ] Postman: collezione TECMA-BSS importata, login e almeno un endpoint autenticato funzionanti contro un ambiente (es. dev).
- [ ] Developer portal: la pagina Swagger mostra tutti i path BSS + Followup con descrizioni leggibili.
- [ ] FE Followup: con VITE_API_BASE_URL puntato al gateway, login e progetti per email (o flusso BSS) funzionano.
