# FollowUp 3.0 — due progetti nel monorepo `tecma`

Sotto `business/tecma-digital-platform/` convivono **due progetti separati** (codebase e layout diversi). **Non** c’è un flusso obbligato “porta la feature da uno all’altro”: si lavora nell’uno o nell’altro secondo il perimetro del ticket.

| Directory | Progetto |
|-----------|----------|
| **`followup-3.0/`** | Monorepo attuale (`apps/`, `services/`, `packages/`, …). CI GitHub: workflow `followup-3.0-*.yml` su path `followup-3.0/**`. |
| **`followup-3.0-POC/`** | Progetto **distinto**: layout `be-followup-v3` / `fe-followup-v3`. |

## Render (`followup-3-be`, `followup-3-fe`)

I servizi collegati al repo **`tecma`** sono configurati (Blueprint / [`render.yaml`](../../render.yaml)) per compilare **solo** path sotto `followup-3.0-POC/`. È una scelta operativa su **qual** progetto quei hostname deployano, **non** una regola che il lavoro fatto in `followup-3.0/` debba essere replicato nella POC.

- Modifiche **solo** in `followup-3.0/` non fanno ripartire il build di quei servizi Render (perché il `buildFilter` non include quel path).
- Per pubblicare il **nuovo** monorepo servirebbe altrove una pipeline/deploy dedicata (nuovi servizi Render o altro), non “mergiare” nel senso tra i due alberi salvo decisione esplicita.


## Render: sintomi «tutto rotto» (solo POC)

Non è (di solito) un conflitto con `followup-3.0/`: i servizi `followup-3-*` buildano dalla POC e dipendono dalle **variabili in Dashboard**.

| Controllo | Dove |
|-----------|------|
| **`VITE_API_BASE_URL`** | Servizio **followup-3-fe**, ambiente di **build**: deve essere `https://followup-3-be.onrender.com/v1` (con `/v1`). Senza, il FE chiama `/v1` sul dominio statico → nulla funziona. |
| **`APP_PUBLIC_URL`** | Servizio **followup-3-be**: deve essere l’URL pubblico del FE (es. `https://followup-3-fe.onrender.com`) per **CORS**. |

Dettaglio: [`followup-3.0-POC/docs/RENDER_FOLLOWUP_ENV.md`](followup-3.0-POC/docs/RENDER_FOLLOWUP_ENV.md).

## Locale (Docker POC)

Il `docker-compose.yml` nella POC e il `Dockerfile` del FE devono riferirsi solo a **`followup-3.0-POC/`** e `design-system/`. Riferimenti a `followup-3.0/fe-followup-v3` mixano l’altro progetto.
