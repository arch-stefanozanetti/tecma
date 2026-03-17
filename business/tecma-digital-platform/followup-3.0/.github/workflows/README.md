# Workflow GitHub Actions – FollowUp 3.0

In questo repo **monorepo (tecma)** i workflow non vanno messi qui: GitHub esegue solo i workflow nella **root** del repository.

- **Pipeline attiva:** [.github/workflows/followup-3.0-ci-cd.yml](../../../../.github/workflows/followup-3.0-ci-cd.yml) (nella root del repo `tecma`). Build + test FE e BE, deploy FE e BE su Vercel (dev/demo/prod).
- **Documentazione:** [docs/DOCS_CI_CD.md](../../docs/DOCS_CI_CD.md), [docs/VERCEL_DEPLOY.md](../../docs/VERCEL_DEPLOY.md).

Se usi un **repo dedicato** solo a followup-3.0 (root = questa cartella), puoi usare come base [docs/ci-cd-workflow.example.yml](../../docs/ci-cd-workflow.example.yml) copiato in `.github/workflows/` nella root di quel repo, adattando i path (senza prefisso `business/tecma-digital-platform/followup-3.0/`).
