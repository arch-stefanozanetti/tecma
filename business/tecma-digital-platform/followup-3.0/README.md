# Followup 3.0

Followup 3.0 is the production-ready Tecma CRM monorepo. This repository replaces the older local structures and is the only project that should be published for Followup 3.0.

## Source Of Truth

```bash
cd /Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0
git rev-parse --show-toplevel
git remote -v
```

Expected repository root:

```text
/Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0
```

Expected remote:

```text
origin  https://gitlab.tecmasolutions.com/business/followup-3.0.git
```

Do not work from `/Users/s.zanetti/dev/tecma` for Followup 3.0 delivery. The sibling `followup-3.0-POC` project is reference-only: inspect behavior there, then implement production-grade code here.

## Quick Start

Prerequisites: Node 22 LTS, pnpm 9, Docker Desktop.

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

Local endpoints:

- API: `http://localhost:8080`
- Web: `http://localhost:5177`
- Health: `curl http://localhost:8080/v1/health`

Login uses real credentials from MongoDB collection `tz_users` on the database configured by `MONGO_DB_NAME`. For an empty local database only, `pnpm --filter @followup/api seed:dev-user` creates a test user.

## Daily Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm lint:openapi
```

Useful targeted checks:

```bash
pnpm --filter @followup/api test
pnpm --filter @followup/api test:integration
pnpm --filter @followup/web test
pnpm --filter @followup/web test:e2e
pnpm run security:hardening
```

## Repository Layout

```text
apps/web/                 React/Vite frontend
services/api/             Fastify API
packages/db/              MongoDB client and repositories
packages/shared-config/   Validated environment loading
packages/shared-rbac/     Role and permission rules
packages/shared-types/    Shared API/domain contracts
packages/api-client/      Typed API client
packages/design-*         Design tokens, icons, themes, primitives
infra/                    Docker, Kubernetes, AWS API Gateway support
architecture/             Curated OpenAPI domain governance
load/                     Load and stress scripts
performance/              Performance smoke scripts
security-aggregator/      Security report aggregation support
tests/                    Cross-package security/e2e tests
tools/                    Utility scripts
docs/                     Onboarding, gates, runbooks, scope
```

Generated artifacts such as `node_modules`, `dist`, `coverage`, `.turbo`, `.env*`, `*.tsbuildinfo`, `playwright-report`, and `security-reports` must stay out of git.

## Quality Bar

- Minimum 85% statements, functions, and lines for touched production modules.
- Target 90% for auth, RBAC, workspace scoping, permissions, and data isolation.
- Public API changes require OpenAPI updates and `pnpm lint:openapi`.
- Backend changes need unit or integration coverage for validation, permissions, and workspace isolation.
- Frontend changes need component/page tests for user flows and permission states.

## Documentation

- [Onboarding](docs/ONBOARDING.md)
- [Canonical scope](docs/CANONICAL_SCOPE.md)
- [CI and test gates](docs/CI_AND_TEST_GATES.md)
- [Deploy runbook](docs/RUNBOOK_DEPLOY.md)
- [Security runbook](docs/SECURITY_RUNBOOK.md)
- [OpenAPI contract](services/api/openapi/openapi.v1.yaml)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Keep the baseline clean: one coherent branch and commit per productionized feature after the standalone baseline.
