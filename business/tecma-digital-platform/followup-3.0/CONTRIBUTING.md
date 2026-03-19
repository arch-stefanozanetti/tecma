# CONTRIBUTING

## Branching

- Branch da `main` con prefisso chiaro (`feature/*`, `fix/*`, `chore/*`, `codex/*`).
- Nessun push diretto su `main`.
- PR obbligatoria per merge.

## Regola base (deploy)

Il build che passa in CI è lo stesso che esegue Render. **Non pushare su main (e non fare merge in main) se la CI non è verde:** così il deploy non fallisce per build. La CI esegue gli stessi script di build usati su Render (`scripts/render-build-fe.sh`, `scripts/render-build-be.sh` nella root del repo tecma). File mancanti o step diversi farebbero fallire la CI prima del deploy.

## Quality gates obbligatori

PR mergeabile solo con:

1. CI BE verde (`ci-be.yml`).
2. CI FE verde (`ci-fe.yml`).
3. Nessun check required in stato pending/fail.

## Checklist PR

1. Scope e rischio descritti.
2. Test aggiunti/aggiornati.
3. Nessun breaking change non documentato.
4. Aggiornata documentazione se necessario.

## Branch protection (GitHub, manuale)

Impostare su `main`:

1. `Require a pull request before merging`.
2. `Require approvals` (minimo 1).
3. `Dismiss stale pull request approvals when new commits are pushed`.
4. `Require status checks to pass before merging`.
5. Status checks required:
   - `CI BE Core Strict / be-core-strict`
   - `CI FE Core Strict / fe-core-strict`
6. `Require branches to be up to date before merging`.
7. `Restrict who can push to matching branches` (opzionale ma raccomandato).

Nota: la configurazione branch protection non è applicabile da repository locale; va impostata in GitHub repository settings.

## Sicurezza repository

1. Abilitare hook locali una volta per clone: `npm run setup:githooks`.
2. Verificare sempre `npm run check:secrets` prima di push.
3. Vietato committare credenziali reali in `.env*`, docs o script.

## Pre-push opzionale (build deploy)

Dopo `npm run setup:githooks`, il hook **pre-push** esegue `npm run deploy:dry-run` (stessa build che usa Render). Consigliato prima di push su branch che andranno in main: se passa in locale, la CI e il deploy Render non falliranno per build. Per saltare il hook in emergenza: `git push --no-verify` (usare con cautela).
