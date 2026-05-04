# Contributing — Followup 3.0

## Repository Rules

Work from the standalone repository only:

```bash
cd /Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0
git rev-parse --show-toplevel
git remote -v
```

The only publication remote for Followup 3.0 is:

```text
https://gitlab.tecmasolutions.com/business/followup-3.0.git
```

The sibling `followup-3.0-POC` project is a functional reference. Do not mutate it while delivering production work in this repo.

## Branch And Commit Workflow

1. Create branches from `main` using `<type>/<TICKET>-<slug>`, for example `feat/FUP3-123-workspace-invites`.
2. Use Conventional Commits: `<type>(<scope>): <subject>`.
3. Open a GitLab MR into `main`.
4. Keep every MR focused on one feature, hardening slice, or cleanup.
5. Merge only after review and green quality gates.

Allowed commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`.

Common scopes: `auth`, `rbac`, `users`, `workspaces`, `projects`, `api`, `web`, `db`, `design-ui`, `design-tokens`, `design-themes`, `design-icons`, `security`, `ci`, `infra`, `docs`.

Examples:

- `feat(auth): introduce tz_users-only authentication`
- `fix(rbac): block cross-workspace fallback`
- `test(db): cover repository write isolation`
- `docs(repo): clarify standalone GitLab onboarding`

## Migrating From The POC

For every feature:

1. Inspect behavior in `../followup-3.0-POC`.
2. Define the production contract in API routes, shared types, and the client.
3. Implement backend domain logic with validation, auth, RBAC, workspace scoping, and logging/audit where applicable.
4. Implement frontend UX using the current app and design-system patterns.
5. Add backend, integration, and frontend tests before considering the feature done.

Never copy POC code blindly. The POC answers "what should the product do"; this repo answers "how should it run in production".

## Definition Of Done

- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm test:integration` passes when API, auth, workspace, or persistence behavior changes.
- `pnpm lint:openapi` passes when public API routes change.
- Touched production modules meet at least 85% statements/functions/lines.
- Security-sensitive modules target 90% coverage.
- No secrets or generated artifacts are staged.
- Documentation is updated when behavior, setup, or operations change.

## Local Quality Gate

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm lint:openapi
git diff --check
```

Useful targeted commands:

```bash
pnpm --filter @followup/api test
pnpm --filter @followup/api test:integration
pnpm --filter @followup/web test
pnpm --filter @followup/web test:e2e
pnpm run security:hardening
```

## Git Hygiene

Before committing:

```bash
git status --short --ignored
git diff --check
git diff --cached --name-only
```

Do not stage `node_modules`, `dist`, `coverage`, `.turbo`, `.env*`, `*.tsbuildinfo`, `playwright-report`, `test-results`, `security-reports`, `.cursor`, `.understand-anything`, or `.githooks`.

## GitLab Remote Setup

The repository should already have `origin` configured. If a fresh clone or local checkout is missing it:

```bash
git remote add origin https://gitlab.tecmasolutions.com/business/followup-3.0.git
git branch -M main
```

Push only when access is available and the baseline or feature branch has passed the local quality gate.
