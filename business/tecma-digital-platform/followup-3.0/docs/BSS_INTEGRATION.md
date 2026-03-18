# Integrazione con il gateway TECMA-BSS (api.tecmasolutions.com)

Questo documento spiega **quando** usare l’auth Followup (locale o backend proprio) e **quando** usare l’auth BSS (gateway API TECMA-BSS) in Followup 3.0, e quali API del gateway sono utili.

## Criterio di scelta: auth Followup vs auth BSS

- **Auth Followup (default)**  
  Usare quando:
  - l’app gira in locale (proxy Vite verso `be-followup-v3`), oppure
  - `VITE_API_BASE_URL` punta al backend Followup (es. istanza diretta) e **non** si richiede single sign-on con il resto della piattaforma Tecma.

  In questo caso il frontend usa gli endpoint del backend Followup:  
  `POST /v1/auth/login`, `GET /v1/auth/me`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, ecc.

- **Auth BSS (gateway)**  
  Usare quando:
  - `VITE_API_BASE_URL` punta al **gateway** (es. `https://api.tecmasolutions.com/biz-tecma-dev1/v1`), e
  - si vuole **single sign-on** con il resto della piattaforma (stesso token e identità del gateway).

  In questo caso impostare **`VITE_USE_BSS_AUTH=true`** nel frontend. Il FE userà gli endpoint auth del gateway:  
  `POST /login` (con `project_id`), `POST /v1/users/getUserByJWT` (come “me”), `POST /v1/auth/refresh-token`.

Riepilogo:

| Scenario                         | VITE_API_BASE_URL              | VITE_USE_BSS_AUTH | Auth usata   |
|----------------------------------|--------------------------------|-------------------|--------------|
| Locale (proxy → be-followup-v3)  | non impostato o `/v1`          | non impostato     | Followup     |
| Deploy verso backend Followup    | URL backend Followup           | `false` o assente | Followup     |
| Deploy verso gateway + SSO       | URL gateway (api.tecmasolutions.com/…/v1) | `true`  | BSS (gateway)|

## API BSS utili per Followup

### Auth (già utilizzate quando `VITE_USE_BSS_AUTH=true`)

- **POST /login**  
  Body: `{ "email", "password", "project_id" }`.  
  Risposta: `token: { tokenType, accessToken, refreshToken, expiresIn }`, `user: { id, firstName, lastName, email, role, TwoFA, project_ids, ... }`.  
  Il FE mappa questa risposta al formato interno (accessToken, refreshToken, user con id, email, role, isAdmin).

- **POST /v1/users/getUserByJWT**  
  Header `Authorization: Bearer <accessToken>`.  
  Usato come “me” (utente corrente da JWT). La risposta BSS viene mappata a `{ id, email, role, isAdmin }`.

- **POST /v1/auth/refresh-token**  
  Refresh del token; corpo/header come richiesto dal backend BSS. Il FE aggiorna access token (e eventualmente refresh token) in sessione.

Con auth BSS il login richiede **project_id** (campo "Project ID" nel form). L’opzione "Accedi con SSO aziendale" non è mostrata (il gateway BSS non espone `sso-exchange`; se necessario si può aggiungere un path sul gateway che punta al backend Followup).

### Inviti, set-password, reset password (MDOO)

Questi flussi sono implementati su **be-followup-v3** (`POST /v1/auth/set-password-from-invite`, `POST /v1/auth/request-password-reset`, `POST /v1/auth/reset-password`, `POST /v1/users` per invito).

- Con **auth Followup** (default / proxy locale): il frontend può usare le pagine `/set-password`, `/reset-password`, `/forgot-password` che chiamano questi endpoint sul backend Followup.
- Con **`VITE_USE_BSS_AUTH=true`**: login e refresh passano dal **gateway BSS**; invito e reset password **non** sono gestiti dal gateway nello stesso modo. Per utenti creati via invito su Followup, **`VITE_API_BASE_URL` deve comunque raggiungere il backend** che espone le API sopra (o il gateway deve proxyare verso be-followup-v3 quei path). In caso contrario il link email (SES) deve puntare a un host che inoltra a be-followup-v3.

### Dati (per uso futuro)

Se in futuro si unificano le fonti dati sul gateway, possono essere utili:

- **GET /v2/projects/{projectId}** – dettaglio progetto
- **GET /v2/projects/hostname/{host}** – progetto per hostname
- **GET /v2/clients/project/{projectId}** – clienti per progetto

Oggi Followup continua a usare i propri endpoint dati su `be-followup-v3` (o gli stessi path esposti tramite gateway che puntano al backend Followup); le API BSS sopra sono elencate per riferimento e possibili evoluzioni.

## Riferimenti

- Differenze auth e opzioni: [AUTH_AND_TECMA_BSS_API_REPORT.md](AUTH_AND_TECMA_BSS_API_REPORT.md)
- Addizioni OpenAPI Followup nel BSS: [openapi-tecma-bss-additions.yaml](openapi-tecma-bss-additions.yaml)
