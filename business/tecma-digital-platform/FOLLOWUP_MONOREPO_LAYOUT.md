# FollowUp 3.0 — due alberi nel monorepo `tecma`

Nel repository convivono **due directory** sotto `business/tecma-digital-platform/`. Hanno ruoli distinti; **Render usa solo la POC**.

| Directory | Ruolo |
|-----------|--------|
| **`followup-3.0/`** | Linea di sviluppo principale (monorepo: `apps/`, `services/`, `packages/`, ecc.). I workflow GitHub `followup-3.0-*.yml` reagiscono alle modifiche sotto questo path. |
| **`followup-3.0-POC/`** | Layout classico con `be-followup-v3` e `fe-followup-v3`. **È l'unico albero incluso in build e deploy Render** per i servizi `followup-3-be` e `followup-3-fe`. |

## Render (onrender.com)

- Contratto: [`render.yaml`](../../render.yaml) alla root del repo — `rootDir` e `buildFilter` includono **solo** path sotto `followup-3.0-POC/`, più `render.yaml` e `scripts/render-build-*.sh` condivisi.
- Una modifica **solo** in `followup-3.0/` **non** innesca un nuovo deploy Render (e non aggiorna l'app in produzione) finché le stesse modifiche non sono presenti in POC o non viene fatto un deploy manuale da path POC.

## Promozione rilascio

Per portare in produzione (Render) una feature sviluppata in `followup-3.0/`, allinea il codice in `followup-3.0-POC/` (merge, cherry-pick o porting manuale, a seconda della strategia del team), poi commit/push su `main` nei path che il `buildFilter` segue.
