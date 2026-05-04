# `@followup/api` — servizio HTTP Followup 3.0

## Avvio locale

```bash
cp services/api/.env.example services/api/.env.local
# Impostare MONGO_URI, MONGO_DB_NAME, AUTH_JWT_SECRET, INTERNAL_API_KEY (≥16 caratteri)
pnpm --filter @followup/api dev
```

## Endpoint principali

| Metodo   | Path                      | Auth                 |
| -------- | ------------------------- | -------------------- |
| GET      | `/v1/health`              | no                   |
| POST     | `/v1/auth/login`          | no                   |
| POST     | `/v1/auth/refresh`        | `x-api-key`          |
| GET      | `/v1/auth/me`             | `x-api-key` + Bearer |
| GET      | `/v1/workspaces`          | JWT + permessi       |
| GET      | `/v1/projects`            | JWT + permessi       |
| GET/POST | `/v1/session/preferences` | JWT                  |

Tutte le route protette richiedono header **`x-api-key`** uguale a `INTERNAL_API_KEY` (allineato TECMA).

## Script utili

| Script                        | Descrizione                                            |
| ----------------------------- | ------------------------------------------------------ |
| `pnpm openapi:generate`       | Rigenera `openapi/openapi.v1.yaml` da Fastify          |
| `pnpm migrate:tz-users`       | Migrazione dati utenti legacy (`--apply` per scrivere) |
| `pnpm migrate:tz-collections` | Indici core `tz_*` (dry-run di default)                |

## Documentazione correlata

- Onboarding repo: `docs/ONBOARDING.md`
- Scope canonico: `docs/CANONICAL_SCOPE.md`
- CI e test gate: `docs/CI_AND_TEST_GATES.md`
- Deploy / rollback: `docs/RUNBOOK_DEPLOY.md`
- Security: `docs/SECURITY_RUNBOOK.md`
