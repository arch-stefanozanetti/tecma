# Design: FE FollowUp su Render (pnpm, Rollup Linux)

**Data:** 2026-03-18  
**Stato:** implementato in repo (`pnpm-lock.yaml`, `render.yaml`, CI).

## Problema

Build Static Site su Render falliva con `Cannot find module @rollup/rollup-linux-x64-gnu`. Cause combinate:

1. `.npmrc` con `optional=false` e `omit=optional` — impediva i binari nativi Rollup su Linux.
2. Cache `node_modules` su Render (`npm install` → "up to date") senza reinstallazione per piattaforma.
3. Bug noto npm sulle optional dependencies (rollup).

## Soluzione

- **pnpm** solo per `fe-followup-v3` + `pnpm-lock.yaml`.
- Build Render: `rm -rf node_modules` poi `corepack` + `pnpm install --frozen-lockfile` + `pnpm run build`.
- Rimozione `optional=false` / `omit=optional` da `.npmrc`.
- CI GitHub Actions: `pnpm/action-setup` + `pnpm install --frozen-lockfile` per il FE (solo build/test; deploy su Render).
- `package-lock.json` del FE rimosso (single source of truth: pnpm).

## Riferimenti

- [RENDER_DEPLOY.md](../RENDER_DEPLOY.md)
- [render.yaml](../../../../render.yaml) (servizio `followup-3-fe`)
