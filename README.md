# Followup 3.1 Backend

This directory is the isolated backend workspace for the `followup-3` repository.
The Lovable frontend remains at the repository root and must access data only
through this API.

## Source

The initial baseline comes from the committed `followup-3.0` API and its shared
packages. Functional gaps will be recovered from `followup-3.0-POC` through
explicit ports and regression tests, not by merging the two codebases.

## Database Constraint

The target runtime must use the CTO-approved legacy database for both reads and
writes. `MONGO_DB_NAME` and `ALLOWED_WRITE_DB` are required and must match.
There is intentionally no default database name.

The imported baseline still contains repositories for the POC `tz_*` model.
Those repositories are migration input, not an approved production data layer.
Do not deploy this backend against production until each active route has a
reviewed legacy adapter and the parity suite passes.

## Integration Status

- The backend workspace is imported and independently buildable/testable.
- The Lovable frontend has not been changed or connected to this API yet.
- Render deployment is intentionally not configured on this branch.
- The current `tz_*` repositories and migration scripts must not run against
  the approved legacy database.
- POC index bootstrap and operational write scripts are disabled unless the
  local/test-only flag `ENABLE_POC_TZ_WRITES=1` is explicitly set.

The next backend phase is to inventory the legacy collections and contracts,
implement read/write adapters route by route, and prove parity with regression
tests. Render can be connected only after that deployment gate is satisfied.

## Local Commands

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @followup/api run dev
```

## Ownership Boundary

- Lovable owns the frontend files at repository root.
- Backend developers own everything under `backend/`.
- The frontend must not connect directly to MongoDB.
- API and database changes require backend review.
