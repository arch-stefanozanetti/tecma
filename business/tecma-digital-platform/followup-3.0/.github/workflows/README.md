# Workflow FollowUp 3.0

- **Checklist comandi prima del merge** (BE test, FE build, E2E, parità CI): [README.md — Checklist prima del merge](../../README.md#checklist-prima-del-merge) nella root `followup-3.0`.
- **CI/CD e secret E2E opzionali:** [docs/DOCS_CI_CD.md](../../docs/DOCS_CI_CD.md).
- **Pipeline attiva (repo tecma):** [.github/workflows/followup-3.0-ci-cd.yml](../../../../.github/workflows/followup-3.0-ci-cd.yml) nella root del monorepo. Solo **build + test** FE e BE.

## Workflow in questa cartella (`followup-3.0/.github/workflows`)

| File | Scopo |
|------|--------|
| `ci-be.yml` | Backend `be-followup-v3`: secret scan, `npm audit --omit=dev --audit-level=high` (**bloccante**), `npm audit --audit-level=high` sull’albero completo (**informativo**, `continue-on-error`), lint, OpenAPI, route-guards, build, coverage core, test integrazione. |
| `ci-fe.yml` | Frontend `fe-followup-v3`: secret scan, `pnpm audit --prod --audit-level=high` (**bloccante**), `pnpm audit --audit-level=high` completo (**informativo**), check panels/architettura, test, typecheck, build, bundle budget, coverage, E2E, Lighthouse PWA. |
| `post-release-acceptance.yml` | Accettazione post-release (se configurata). |

Dettaglio policy audit: [docs/SECURITY_RUNBOOK.md](../../docs/SECURITY_RUNBOOK.md) (§3 e §7). Scope monorepo: [docs/CANONICAL_SCOPE.md](../../docs/CANONICAL_SCOPE.md).

- **Deploy:** [docs/RENDER_DEPLOY.md](../../docs/RENDER_DEPLOY.md) (Render + `render.yaml`). Il push su `main` che passa la CI attiva di solito il deploy automatico sui servizi collegati.
