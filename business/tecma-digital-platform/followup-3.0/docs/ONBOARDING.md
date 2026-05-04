# Onboarding — Followup 3.0

## Source Of Truth

Followup 3.0 is developed and published from the standalone repository:

```bash
cd /Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0
git rev-parse --show-toplevel
git remote -v
```

Expected root:

```text
/Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0
```

Expected remote:

```text
origin  https://gitlab.tecmasolutions.com/business/followup-3.0.git
```

Do not publish Followup 3.0 from `/Users/s.zanetti/dev/tecma`. The parent repository is not the operational path for this product.

## First Setup

```bash
nvm use
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install

cp services/api/.env.example services/api/.env.local
cp apps/web/.env.example apps/web/.env.local

docker compose up -d
pnpm dev
```

Check the services:

```bash
curl http://localhost:8080/v1/health
```

- API: `http://localhost:8080`
- Web: `http://localhost:5177`

## POC Reference Workflow

The sibling project `../followup-3.0-POC` is reference-only.

When migrating one capability:

1. Inspect the POC behavior and user flow.
2. Write the production contract in shared types, API routes, OpenAPI, and API client where needed.
3. Implement backend logic with auth, RBAC, workspace scoping, validation, and logging/audit where applicable.
4. Implement frontend UX using the current app structure and design patterns.
5. Add unit, integration, and frontend tests.
6. Run the local quality gate before staging.

## Quality Gates

Run before opening an MR:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm lint:openapi
git diff --check
```

Coverage expectations:

- At least 85% statements, functions, and lines for touched production modules.
- Target 90% for auth, RBAC, permissions, workspace scoping, and data isolation.
- Do not lower coverage to merge a feature.

## Local Cleanup

Generated and local-only artifacts are ignored by git. To reset a noisy checkout:

```bash
rm -rf node_modules .pnpm-store .turbo dist coverage playwright-report test-results security-reports
find . -name '*.tsbuildinfo' -delete
find . -name '.DS_Store' -delete
```

After cleanup, reinstall dependencies with `pnpm install`.

## Before Commit

```bash
git status --short --ignored
git diff --check
git diff --cached --name-only
```

Do not stage secrets, `.env*`, generated output, package `node_modules`, local IDE folders, or agent artifacts.
