# Review: branch `cursor/keycloak-identity-provider-b16b`

**Base:** `main` @ `0d115064`  
**Tip branch:** `799e0446` — `feat(fe): login OIDC Keycloak (PKCE) e callback verso sso-exchange`  
**File toccati:** 9 file, +302 / −9 linee (solo FE + `.env.example` BE/FE).

## Sintesi

Il branch aggiunge un flusso **OIDC Authorization Code + PKCE** dal browser verso Keycloak, una **pagina callback** che scambia il `code` per **id_token** e chiama **`followupApi.ssoExchange`** (allineato a `POST /v1/auth/sso-exchange` sul BE esistente).

## Punti di forza

- **PKCE** (`S256`) e client pubblico: niente secret nel FE.
- **State** e **code_verifier** in `sessionStorage`, consumo coerente al ritorno.
- **Callback** usa `ssoExchange(idToken)` → riuso del contratto backend già pensato per JWT esterni.
- **Redirect post-login:** tentativo di risolvere `backTo` solo se **same-origin**, altrimenti fallback `/`; evita open redirect verso domini esterni.
- **Test unitario** presente: `keycloakOidc.test.ts`.

## Rischi / azioni consigliate

1. **BE non nel diff:** verificare che in ogni ambiente `SSO_JWKS_URI` / issuer / audience combacino con il realm Keycloak reale; senza configurazione, `sso-exchange` fallisce o resta 503.
2. **id_token vs access_token:** il branch passa **id_token** a `sso-exchange`. Confermare che `extractEmailFromSsoPayload` e i claim attesi dal BE siano compatibili con i claim Keycloak (es. `email`, `preferred_username`).
3. **Route:** aggiunta route callback in `App.tsx` — verificare coerenza con `BrowserRouter` e base path Vite (`base`) se si usa deploy sotto sottopath (`/app/channel/`).
4. **LoginPage:** verificare UX (coesistenza temporanea con login password/BSS fino a cutover) e messaggi se Keycloak non configurato.
5. **Error handling:** messaggi utente su callback già presenti; aggiungere logging lato BE per audit fallimenti exchange in staging.

## Verdetto

**Approvare come base** per iterazione successiva (config Keycloak + test e2e + hardening). Nessun blocco architetturale rispetto al design “IdP + exchange” documentato nella spec.
