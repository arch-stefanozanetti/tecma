# `@followup/api` - baseline backend Followup 3.1

Questo servizio e stato importato come base tecnica nel repository condiviso
con il frontend Lovable. Il target approvato legge e scrive sul database
legacy indicato dal CTO: `MONGO_DB_NAME` e `ALLOWED_WRITE_DB` sono obbligatori
e devono coincidere.

La baseline contiene ancora route e repository basati sul modello POC `tz_*`.
Non e quindi pronta per il deploy su Render o per l'uso sul database di
produzione: prima servono adapter legacy revisionati e test di parita.
Il bootstrap degli indici e gli script di scrittura `tz_*` sono disabilitati
senza l'opt-in locale/test `ENABLE_POC_TZ_WRITES=1`.

## Avvio locale

```bash
cp services/api/.env.example services/api/.env.local
# Impostare MONGO_URI, MONGO_DB_NAME, ALLOWED_WRITE_DB,
# AUTH_JWT_SECRET e INTERNAL_API_KEY (almeno 16 caratteri)
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

| Script                        | Descrizione                                             |
| ----------------------------- | ------------------------------------------------------- |
| `pnpm openapi:generate`       | Rigenera `openapi/openapi.v1.yaml` da Fastify           |
| `pnpm migrate:tz-users`       | Utility POC `tz_*`; non autorizzata sul database legacy |
| `pnpm migrate:tz-collections` | Utility POC `tz_*`; non autorizzata sul database legacy |

## Documentazione correlata

- [Perimetro e stato dell'import](../../README.md)
- [Contratto OpenAPI](openapi/openapi.v1.yaml)
