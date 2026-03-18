# CONTRIBUTING

## Branching

- Branch da `main` con prefisso chiaro (`feature/*`, `fix/*`, `chore/*`, `codex/*`).
- Nessun push diretto su `main`.
- PR obbligatoria per merge.

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
