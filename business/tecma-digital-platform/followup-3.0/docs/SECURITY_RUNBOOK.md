# Security Runbook — Followup 3.0

## 1) Immediate secret leak response
- Revoke compromised credentials immediately (MongoDB URI user, SMTP/API tokens).
- Rotate secrets in secret manager / deployment platform.
- Validate all environments (dev/stage/prod) use rotated values.
- Audit access logs around leak window.

## 2) Repository hardening policy
- Never commit real credentials in `.env*`, docs, scripts, fixtures.
- Keep only placeholders in tracked files (`.env.example`).
- Use `npm run check:secrets` before every push.
- Enable local git hook once per clone:
  - `npm run setup:githooks`

## 3) CI controls
- `scripts/check-no-secrets.sh` is mandatory and blocking in CI.
- PRs fail on potential hardcoded secrets.
- No bypass except repository admin emergency hotfix with post-incident review.
- **Audit dipendenze (policy Followup 3.0):**
  - **BE** (`ci-be.yml`): bloccante `npm audit --omit=dev --audit-level=high` (solo dipendenze di runtime). Step aggiuntivo **informativo** `npm audit --audit-level=high` sull’intero albero (include devDependencies, es. Stryker): `continue-on-error: true` così la PR resta verde ma il log mostra advisory su toolchain.
  - **FE** (`ci-fe.yml`): bloccante `pnpm audit --prod --audit-level=high`. Step informativo sull’albero completo con `continue-on-error: true`.
  - DevDependencies con advisory noti vanno **tracciati** (issue o risk acceptance) e riesaminati a release / trimestralmente.

## 4) Deployment checklist
- Confirm required env vars are set server-side (not in repo).
- Verify `AUTH_JWT_SECRET` length/policy in staging/prod.
- Verify CORS origins are explicit and valid.
- Run smoke tests for auth/login and portal routes after deploy.

## 5) Incident closure checklist
- Root cause documented.
- Blast radius documented.
- Rotations completed and validated.
- CI/guardrails updated if detection missed.

---

## 6) Threat model (minimo)

- **Autenticazione:** JWT (access + refresh); token solo in header `Authorization`. Nessun token in query/URL. Sessioni portal e BSS gestite con token dedicati.
- **Tenant isolation:** Tutte le API che accettano `workspaceId`/`projectId` devono passare dal middleware `requireCanAccessWorkspace`/`requireCanAccessProject` (controllo centralizzato in `canAccess`). Allowlist per route pubbliche in `docs/ROUTE_ACCESS_ALLOWLIST.md`. CI `check:route-guards` blocca route senza guardia.
- **Realtime (SSE):** Token solo da header; `workspaceId`/`projectId` validati con `canAccess` prima di aprire lo stream. Nessun token in query string.
- **Esposizione API:** CORS restrittivo; Helmet per header di sicurezza; rate limit e proxy trust in produzione. API pubbliche limitate a health, openapi, portal pubblico, platform (con API key).

## 7) Dependency risk e vulnerability

- **Runtime vs dev:** la barra “verde” in CI è sull’**installazione di produzione** (BE: `npm audit --omit=dev`; FE: `pnpm audit --prod`), severità **high+**. Le devDependencies restano visibili nello step audit “informativo” e vanno gestite come sopra §3.
- Eseguire regolarmente anche in locale `npm audit` / `pnpm audit` prima di release importanti.
- **Import Excel unità (BE):** parsing con `read-excel-file` (sostituisce il pacchetto `xlsx` deprecato dal punto di vista advisory).
- **serialize-javascript (FE, transitiva):** monitorare aggiornamenti della catena. In caso di high non risolvibile nel solo albero `--prod`, valutare override o risk acceptance (owner, scadenza review).
- Prima di dichiarare “enterprise-ready”: nessun **high+** non mitigato sulle dipendenze **effettivamente ship** (runtime); per dev/tooling, risk acceptance esplicita se persistente.
