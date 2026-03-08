# CI/CD – Tre ambienti (dev, demo, prod)

Workflow: [.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml). Copia di esempio: [docs/ci-cd-workflow.example.yml](ci-cd-workflow.example.yml).

## Branch e comportamenti

| Branch   | Build + test | Deploy        | Quando                    |
|----------|--------------|---------------|---------------------------|
| develop  | Sì           | Dev (auto)    | Ogni push                 |
| demo     | Sì           | Demo (auto)   | Ogni push                 |
| main     | Sì           | No (auto)     | Ogni push                 |
| main     | Sì           | Prod (manuale)| Solo "Run workflow"       |

- **develop** → deploy automatico su ambiente **dev** (Vercel Preview).
- **demo** → deploy automatico su ambiente **demo** (Vercel Preview).
- **main** → nessun deploy automatico; rilascio **prod** solo tramite **Actions → CI/CD → Run workflow** (e approvazione ambiente `production` se configurata).

## Secret GitHub obbligatori

In **Settings → Secrets and variables → Actions** aggiungi:

| Secret             | Descrizione |
|--------------------|-------------|
| `VERCEL_TOKEN`     | Token Vercel (Account Settings → Tokens). |
| `VERCEL_ORG_ID`    | Da `vercel link` in locale o da Project Settings su Vercel. |
| `VERCEL_PROJECT_ID`| Id progetto Vercel (stesso posto). |

Per trovare Org ID e Project ID: nella dashboard Vercel apri il progetto → Settings → General, oppure esegui `vercel link` nella cartella `fe-followup-v3` e leggi `.vercel/project.json`.

## Ambiente GitHub "production" (opzionale)

Per richiedere un **approval** prima del deploy prod:

1. **Settings → Environments** → New environment → nome `production`.
2. Seleziona **Required reviewers** e aggiungi uno o più reviewer.
3. Nel workflow il job `deploy-prod` usa già `environment: production`, quindi il deploy parte solo dopo l’approvazione.

## Creazione dei branch

Se non esistono ancora:

```bash
git checkout -b develop
git push -u origin develop

git checkout -b demo
git push -u origin demo
```

`main` è il branch di produzione (di solito già presente).

## Vercel

1. Collega il repo GitHub a Vercel (Import Project).
2. **Root Directory**: imposta `fe-followup-v3` (monorepo).
3. Disattiva i deploy automatici da Vercel per evitare doppi deploy: in Project Settings → Git puoi lasciare che siano solo le Actions a deployare, oppure usa solo le Actions e non collegare il repo a Vercel per auto-deploy (deploy solo via Actions con i secret sopra).

## RabbitMQ / Grafana

Non sono richiesti per questa pipeline. Si aggiungono in seguito solo se servono code di messaggi (RabbitMQ) o dashboard/alerting (Grafana).
