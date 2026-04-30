# Route access guards (CI)

Lo script `scripts/check-route-guards.mjs` verifica che le route HTTP nei file elencati dichiarino:

- `requireCanAccessWorkspace` o `requireCanAccessProject`, oppure
- `requireAccessToWebhookConfigById()` (solo `webhook-configs.routes.ts` per PATCH/DELETE su `:id`).

File controllati: `clients`, `requests`, `apartments`, `webhook-configs`, `assets`, `client-documents`, `workspaces`.

Per **workspaces**, sono ammessi anche `requireAdmin`, `requireTecmaAdmin`, `requirePermission` / `requireAnyPermission` / `requirePermissionOrTecmaAdmin`, oppure il commento `route-guard: workspace-list-self-filtered` sulla lista `/workspaces` (filtro membership nel handler).

Estendere l’elenco nello script quando si aggiungono nuovi router multi-tenant con lo stesso requisito.
