# Workflow FollowUp 3.0

- Checklist comandi prima del merge: [README.md — Checklist prima del merge](../../README.md#checklist-prima-del-merge).
- CI/CD e gate di sicurezza: [docs/CI_AND_TEST_GATES.md](../../docs/CI_AND_TEST_GATES.md), [docs/SECURITY_RUNBOOK.md](../../docs/SECURITY_RUNBOOK.md).

## Workflow in questa cartella (`followup-3.0/.github/workflows`)

| File                          | Scopo |
| ----------------------------- | ----- |
| `ci-be.yml`                   | Quality gate API greenfield (`services/api`): secret scan, lint, typecheck, build, unit test e integration test. |
| `ci-fe.yml`                   | Quality gate Web greenfield (`apps/web`): secret scan, lint, typecheck, build, unit test ed E2E Playwright. |
| `post-release-acceptance.yml` | Accettazione post-release manuale su URL BE/FE forniti come input workflow. |

## Note operative

- I workflow locali in questa cartella sono allineati al monorepo canonico (`apps/*`, `services/*`, `packages/*`).
- Non sono previsti job su path legacy o su repository POC.
