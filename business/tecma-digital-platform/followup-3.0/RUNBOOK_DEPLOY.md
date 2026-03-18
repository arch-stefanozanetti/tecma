# RUNBOOK_DEPLOY

## Scope

Runbook operativo per avvio locale containerizzato e deploy minimo ripetibile di Followup 3.0.

## Prerequisiti

- Docker Desktop >= 4.x
- Docker Compose v2
- Porta `8080` libera per BE
- Porta `5177` libera per FE
- Porta `27017` libera per MongoDB

## Avvio locale (container)

```bash
docker compose up --build
```

Servizi:
- FE: `http://localhost:5177`
- BE API: `http://localhost:8080/v1/health` (o endpoint equivalente)
- MongoDB: `localhost:27017`

## Stop

```bash
docker compose down
```

Rimozione volumi DB:

```bash
docker compose down -v
```

## Deploy BE (immagine runtime)

```bash
docker build -f Dockerfile --target runtime -t followup-be:latest be-followup-v3
docker run --rm -p 8080:8080 \
  -e MONGO_URI="<mongo-uri>" \
  -e MONGO_DB_NAME="<db-name>" \
  -e AUTH_JWT_SECRET="<secret>" \
  -e APP_PUBLIC_URL="<fe-url>" \
  followup-be:latest
```

## Deploy FE (immagine runtime)

```bash
docker build -f followup-3.0/fe-followup-v3/Dockerfile --target runtime -t followup-fe:latest ..
docker run --rm -p 5177:80 followup-fe:latest
```

## Smoke check post-deploy

1. `GET /v1/health` risponde 200.
2. Login FE riuscito.
3. Query clienti con scope valido.
4. Creazione/modifica trattativa base.

## Rollback minimo

1. Ripristinare immagine precedente (`followup-be:<previous>`, `followup-fe:<previous>`).
2. Riavviare servizi.
3. Rieseguire smoke check.
