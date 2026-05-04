# Contratti OpenAPI (allineamento TECMA / API Gateway)

Questa cartella contiene **spec OpenAPI 3** per dominio, pensate per import in AWS API Gateway e lint **Spectral** (stesse convenzioni di path `/v1/...`, `operationId` camelCase, schemi `ErrorResponse`, `ApiKeyAuth` + `BearerAuth`).

## Domini

| Cartella               | Responsabilità                                   |
| ---------------------- | ------------------------------------------------ |
| `domains/auth/v1/`     | Health, login, refresh, logout, me, SSO exchange |
| `domains/platform/v1/` | Workspaces, users, progetti, preferenze sessione |

La spec generata da runtime (`pnpm turbo run openapi:generate --filter=@followup/api`) resta in `services/api/openapi/openapi.v1.yaml` per smoke contract; i file qui sono **curati** per governance e review umana.

## Comandi

Dalla root monorepo:

```bash
pnpm lint:openapi:domains
pnpm lint:openapi
```
