# Followup 3.0

CRM multi-progetto Tecma. Rebuild production-ready del POC `followup-3.0-POC`.

## Quick start (dev locale)

```bash
# 1. Prerequisiti: Node 22 LTS, pnpm 9, Docker
nvm use
corepack enable && corepack prepare pnpm@9.15.9 --activate

# 2. Install dipendenze
pnpm install

# 3. Avvia infrastruttura locale (Mongo + Redis)
docker compose up -d

# 4. Copia env
cp services/api/.env.example services/api/.env.local
cp apps/web/.env.example apps/web/.env.local

# 5. Avvio dev
pnpm dev
```

- API: http://localhost:8080
- Web: http://localhost:5177
- Health: `curl http://localhost:8080/v1/health`

**Login:** usa **email e password di un utente reale** già in MongoDB, collection **`tz_users`**, sul database configurato in `MONGO_DB_NAME` (deve coincidere con quello a cui punta l’API). Non esiste una “utenza di progetto” fissa: sono le credenziali del **tuo** cluster/DB.

Lo script opzionale `pnpm --filter @followup/api seed:dev-user` serve solo per **DB locale vuoto** o smoke test: crea un utente **fittizio** (default come nei test automatici). Su DB già popolato **non serve** e non sostituisce gli account reali.

## Struttura del monorepo

```
followup-3.0/
├── apps/web/                # Frontend React (Vite + Tailwind)
├── services/api/            # Backend Fastify
├── packages/
│   ├── db/                  # MongoClient + assertWritableDatabase + repositories
│   ├── shared-config/       # Env loader Zod-validated (boot kill-switch)
│   ├── shared-rbac/         # Permission catalog + roles + canAccess pure functions
│   ├── shared-types/        # Type contracts FE↔BE
│   ├── logger/              # Pino + redaction
│   ├── api-client/          # Tipizzato auto da OpenAPI (FE)
│   ├── design-tokens/       # Token DS + CSS variabili/font
│   ├── design-icons/        # Libreria icone DS
│   ├── design-ui/           # Primitive UI DS (React)
│   ├── design-themes/       # Layer temi DS (auth, ecc.)
│   └── ui/                  # Componenti UI legacy condivisi
├── infra/
│   ├── docker/              # Dockerfile multi-stage api/web
│   ├── k8s/charts/          # Helm chart api/web per OKE
│   ├── oci/                 # External Secrets Operator + OCI Vault refs
│   └── aws-api-gateway/     # Sync OpenAPI verso repo aws-api-gateway
├── tests/
│   ├── e2e/                 # Playwright cross-app
│   ├── load/                # k6
│   └── security/            # db-isolation acceptance + custom tests
├── tools/scripts/           # Sync OpenAPI + utility
├── .gitlab/ci/              # Template CI inclusi da .gitlab-ci.yml
└── docs/
    ├── adr/                 # Architecture Decision Records
    ├── runbooks/            # Incident playbook + DBA tickets
    └── openapi/             # Mirror della spec generata
```

## Vincoli non negoziabili

> **CRITICAL: Si scrive SOLO su MongoDB `test-zanetti`.** Tutti gli altri DB del cluster `dev-1` sono read-only assoluti. Vedi [ADR 0002](docs/adr/0002-db-write-isolation.md).

- API REST only (no GraphQL/WebSocket bidirectional).
- OpenAPI 3.0.1 obbligatoria su ogni endpoint (compatibile AWS API Gateway).
- Auth via Bearer JWT + `x-api-key` (eccetto `/health`).
- Coverage core ≥85% statements / ≥80% branches.
- Mutation score Stryker ≥70% sui domini auth + rbac + workspace + project.

## CI/CD

- **GitLab CI** con stages `install → lint → test → security → build → deploy`.
- Pipeline definite in [`.gitlab-ci.yml`](./.gitlab-ci.yml) e template [`.gitlab/ci/*.yml`](./.gitlab/ci/).
- Deploy: `dev-1` automatico, `demo` + `prod` manual approval.

## Documentazione

- Architecture Decision Records: [`docs/adr/`](docs/adr/)
- Runbook operativi: [`docs/runbooks/`](docs/runbooks/)
- Branch governance: [`docs/runbooks/branch-governance.md`](docs/runbooks/branch-governance.md)
- Design system governance: [`docs/runbooks/design-system-governance.md`](docs/runbooks/design-system-governance.md)
- OpenAPI: [`services/api/openapi/openapi.v1.yaml`](services/api/openapi/openapi.v1.yaml)
- Test runbook: [`docs/runbooks/testing.md`](docs/runbooks/testing.md)

## Contributing

Vedi [CONTRIBUTING.md](./CONTRIBUTING.md). Conventional commits + branch protection + MR review obbligatoria.
