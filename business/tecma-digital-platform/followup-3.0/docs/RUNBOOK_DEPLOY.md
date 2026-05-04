# RUNBOOK_DEPLOY

## Scope

Runbook operativo per avvio locale containerizzato e deploy minimo ripetibile di Followup 3.0 (stack greenfield `apps/web` + `services/api`).

## Prerequisiti

- Docker Desktop >= 4.x
- Docker Compose v2
- Porta `8080` libera per API
- Porta `5177` libera per Web
- Porta `27017` libera per MongoDB

## Avvio locale (container)

```bash
docker compose up --build
```

Servizi:

- Web: `http://localhost:5177`
- API: `http://localhost:8080/v1/health`
- MongoDB: `localhost:27017`

## Stop

```bash
docker compose down
docker compose down -v
```

## Build immagini runtime

### API

```bash
docker build -f infra/docker/Dockerfile.api --target runtime -t followup-api:latest .
```

### Web

```bash
docker build -f infra/docker/Dockerfile.web --target runtime -t followup-web:latest .
```

## Smoke check post-deploy

1. `GET /v1/health` risponde 200.
2. Login Web riuscito.
3. Accesso workspace/progetti funzionante.
4. `pnpm run test:hardening` verde sul branch rilasciato.

## Gate finali accettazione

1. CI greenfield BE/FE completamente verde (`ci-be.yml`, `ci-fe.yml`).
2. E2E Playwright verde (`pnpm --filter @followup/web test:e2e`).
3. Verifica post-release su ambiente target:

```bash
BE_URL="https://api.example.com" \
FE_URL="https://app.example.com" \
AUTH_BEARER="<token-opzionale>" \
bash scripts/post-release-verify.sh
```
