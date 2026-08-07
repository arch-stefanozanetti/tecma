# Followup 3.1 Backend

This directory is the isolated backend workspace for the `followup-3` repository.
The Lovable frontend remains at the repository root and must access data only
through this API.

## Source

The initial baseline comes from the committed `followup-3.0` API and its shared
packages. Functional gaps will be recovered from `followup-3.0-POC` through
explicit ports and regression tests, not by merging the two codebases.

## Database Strategy

The runtime must never connect to the legacy databases. During the current
staging/POC phase it uses `test-zanetti` and the greenfield `tz_*` model. The
final greenfield database will be designed after the complete product model has
been validated and will use a different name.

`MONGO_DB_NAME` and `ALLOWED_WRITE_DB` are required and must match. This guard
keeps each deployment confined to its explicitly selected greenfield database.
Legacy data migration into the final database is a later, separate project; it
is not part of the runtime architecture.

## Integration Status

- The backend workspace is imported and independently buildable/testable.
- The Lovable frontend has not been changed or connected to this API yet.
- Render service: <https://followup-3-1-be.onrender.com>.
- Render deploys are manual and use the backend-only branch
  `codex/followup-3-1-backend`; the GitLab repository remains the source of
  truth.
- The current `tz_*` repositories are the staging baseline to validate and
  evolve before designing the final greenfield database.
- Index bootstrap and operational scripts require the explicit
  `ENABLE_POC_TZ_WRITES=1` flag and may only target an approved greenfield
  environment such as `test-zanetti`.

The current Render POC runs with index bootstrap disabled because
`test-zanetti.tz_projects` contains duplicate `(workspaceId, code)` values.
Normal API writes remain enabled. No data was deleted or silently deduplicated.
Before production, the final greenfield database must satisfy all unique and
TTL indexes and start with bootstrap enabled.

SMTP delivery is currently mocked, SSO is not configured, connector discovery
is stub-backed, and asset uploads use the staging inline fallback. These are
intentional POC limits, not production behavior.

The next backend phase is to close functional gaps against the Lovable POC,
stabilize API contracts, and validate the canonical workspace/RBAC/domain
model. Legacy analysis is needed only to plan the future offline migration.

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
