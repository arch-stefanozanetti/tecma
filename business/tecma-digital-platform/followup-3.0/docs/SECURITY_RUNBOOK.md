# Security Runbook — Followup 3.0

## 1) Immediate secret leak response
- Remove exposed credentials from tracked files and docs immediately.
- Replace unsafe defaults (`change-me`, embedded passwords, hardcoded API keys) with mandatory env vars.
- Validate all environments (dev/stage/prod) use secret manager values and no cleartext in repo.
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
