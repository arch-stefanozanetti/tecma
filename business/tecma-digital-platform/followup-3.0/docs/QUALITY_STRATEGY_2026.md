# Quality Strategy 2026 (BE + FE)

## Goals (professional target)

### Backend (core)
- 85-90% lines/statements/functions/branches on core scope.
- 100% on critical layers:
  - `src/core/auth/auth.service.ts`
  - `src/core/workflow/workflow-engine.service.ts`
  - `src/core/pricing/price-normalizer.ts`
  - `src/core/rbac/permissions.ts`

### Frontend (core)
- 75-85% lines/statements on core scope.
- 70%+ functions/branches on core scope.
- E2E on core journeys (auth, scope, clients, apartments, requests, calendar).

### Quality depth
- Mutation testing on mission-critical modules for BE/FE.

## Enforcement model

Two profiles are enforced by scripts:

- `floor` (blocking in CI now): realistic quality gate that must pass on every PR.
- `target` (professional goal): stricter gate used as north-star and release readiness metric.

## Commands

### Backend
- `npm run test:coverage:core`
- `npm run check:coverage:core:floor`
- `npm run check:coverage:core:target`
- `npm run test:mutation:critical`

### Frontend
- `pnpm run test:coverage:core`
- `pnpm run check:coverage:core:floor`
- `pnpm run check:coverage:core:target`
- `pnpm run test:mutation:critical`

## Mutation testing scope

### Backend
- auth service
- workflow engine
- pricing normalizer
- permissions constants

### Frontend
- project scope auth logic
- API http client and auth/domain adapters

## Notes
- `target` profile is intentionally hard and may fail until hardening waves are completed.
- `floor` profile keeps quality ratcheting while preserving delivery pace.
