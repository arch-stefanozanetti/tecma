# Route Access Allowlist

Route patterns that are **public** (no tenant access guard) or use **custom access logic** (e.g. realtime). All other v1 routes that accept `workspaceId` or `projectId` must use `requireCanAccessWorkspace` or `requireCanAccessProject` middleware.

## Public (no auth or platform key only)

- `GET /v1/health` — health check
- `GET /v1/openapi.json` — OpenAPI spec
- `GET /v1/portal/*` — customer portal public routes (as defined in customer-portal.routes)
- `POST /v1/platform/*` — platform API (protected by API key, not workspace)
- `GET /v1/realtime/stream` — auth via Bearer only; workspace/project access checked inside handler with `canAccess`

## Custom access (guard inside handler)

- `GET /v1/realtime/stream` — Token from `Authorization` header only; `canAccess(workspace)` and optional `canAccess(project)` run in handler before opening SSE.

## Protected route files (must have guard on every route)

These files are checked by `scripts/check-route-guards.mjs`; every route registration must include `requireCanAccessWorkspace` or `requireCanAccessProject`:

- `src/routes/v1/clients.routes.ts`
- `src/routes/v1/requests.routes.ts`
- `src/routes/v1/apartments.routes.ts`

When adding new routes in these files, add the appropriate guard. When adding new route files that accept `workspaceId`/`projectId`, add the file to the script and ensure every route has a guard.

## CI

Run locally: `cd be-followup-v3 && npm run check:route-guards`. Add a step in `.github/workflows/ci-be.yml` before `check:no-legacy-runtime`: `- run: npm run check:route-guards`.
