# Branch in parking — followup-3.0

Snapshot al **2026-05-05** dopo il branch cleanup.

I branch elencati qui contengono **commit unici** non ancora portati su `main`,
ma rappresentano lavori interessanti che il team vuole rivalutare prima di
archiviare definitivamente. Ogni branch ha una **data di review** entro la
quale va presa una decisione: integrare (cherry-pick / rebase / nuova PR) o
archiviare con tag `archive/<branch>-2026-05` e cancellare.

> Convenzione: passata la data di review, se non c'è una decisione
> documentata, il branch viene **archiviato come tag** e cancellato dal
> remote. La storia resta accessibile via `git checkout archive/<...>`.

## Riepilogo branch parcheggiati

| Branch (remote) | Ahead | Behind | Ultimo commit | Autore | Tema | Review entro | Decisione attesa |
|---|---|---|---|---|---|---|---|
| `origin/feature/keycloak-migration` | 15 | 72 | 2026-03-25 | Stefano Zanetti | Migrazione SSO/OIDC verso Keycloak (Big Data, marketing connectors, API hardening) | 2026-06-30 | Decidere se riprendere come long-running feature o archiviare. Strettamente legato a `pr/followup-keycloak-to-main` e `cursor/keycloak-identity-provider-b16b`. |
| `origin/pr/followup-keycloak-to-main` | 11 | 72 | 2026-03-25 | Stefano Zanetti | Merge target alternativo per keycloak-migration | 2026-06-30 | Da chiudere o assorbire insieme alla decisione su `keycloak-migration`. |
| `origin/cursor/keycloak-identity-provider-b16b` | 1 | 72 | 2026-03-24 | Cursor Agent | FE login OIDC Keycloak (PKCE) + callback verso sso-exchange | 2026-06-30 | Cherry-pick mirato su una `feat/auth-keycloak-pkce` se la migrazione viene ripresa. |
| `feature/big-data-marketing-ui` (locale, no upstream) | 12 | 72 | 2026-03-25 | Stefano Zanetti | UI Big Data + marketing connectors (CI required checks alignment) | 2026-06-30 | Valutare estrazione del solo allineamento CI; il resto può confluire in keycloak-migration. |
| `origin/feature/appuntamenti-design-system-v2` | 11 | 108 | 2026-03-19 | Francesco Stravino | Design System v2 per modulo Appuntamenti (fix CI npm ci in design-system) | 2026-06-30 | Coordinare con il team Design System: rebase su main o estrarre i fix CI separatamente. |
| `origin/feat/followup-experimental-editor` | 1 | 48 | 2026-03-27 | Stefano Zanetti | Superadmin experimental area + integrazione Pascal Editor | 2026-07-31 | Decidere se promuovere a feature stabile o trattare come spike e archiviare. |
| `origin/fix/fe-recharts-render-build` | 1 | 52 | 2026-03-26 | Stefano Zanetti | Fix build Recharts (legacy progetto, workflow hard-cut, reporting e UI) | 2026-06-30 | Verificare se il fix è ancora rilevante post baseline; se sì, riportare con cherry-pick mirato. |
| `origin/fix/render-be-tsc-build` | 2 | 71 | 2026-03-25 | Stefano Zanetti | Fix Render build TS (ga4 RowMetrics type per strict tsc) | 2026-06-30 | Cherry-pick su `fix/be-render-tsc-strict` se il problema è ancora riproducibile. |
| `origin/cursor/vercel-deploy-problema-41da` | 2 | 174 | 2026-03-13 | Cursor Agent | Fix build Vercel — uso tema tailwind dal design-system sorgente | 2026-06-30 | Verifica se il problema è ancora aperto; in caso contrario archive. |

## Branch locali in parking

| Branch | Stato | Note |
|---|---|---|
| `feature/keycloak-migration` | mirror di `origin/feature/keycloak-migration` | da mantenere finché non si decide sulla feature. |
| `feat/followup-experimental-editor` | mirror di `origin/feat/followup-experimental-editor` | come sopra. |
| `fix/fe-recharts-render-build` | mirror di `origin/fix/fe-recharts-render-build` | come sopra. |
| `feature/big-data-marketing-ui` | NO upstream (`origin` non lo ha) | da pubblicare su `origin/feature/big-data-marketing-ui` se si decide di riprenderlo. |
| `codex/ds-panel-unification-wave` | locale, **bloccato da worktree esterno** (`~/.codex/worktrees/60e9/tecma`) | tag archive `archive/codex-ds-panel-unification-wave-2026-03-19` già presente. Da cancellare quando il worktree viene chiuso (`git worktree remove ~/.codex/worktrees/60e9/tecma && git branch -D codex/ds-panel-unification-wave`). |

## Gitlab — branch da gestire

- `gitlab/main` resta su `f1086c95` (init/README) per **branch protection**: il push di `main` locale è stato pubblicato come `gitlab/sync/from-github-2026-05-05`. Decidere con il team se sbloccare la protection per allineare anche `gitlab/main`, oppure tenere lo sync branch come canale operativo.
- `gitlab/sync/main-from-github` (vecchio sync, push delete rifiutato): valutare se necessita protezione/cleanup manuale dalla UI GitLab.
- `gitlab/feature/appuntamenti-design-system-v2` e `gitlab/cursor/vercel-deploy-problema-41da` rimangono come mirror dei rispettivi `origin/`. Stessa decisione del corrispondente origin.
- `gitlab/archive/gitlab-pre-github-mirror-2026-03-23` è già un branch di archivio storico — non toccare.

## Tag di archivio creati durante la cleanup

- `archive/pre-cleanup-baseline-2026-05-05` — HEAD pre-cleanup (su entrambi i remote).
- `archive/legacy-develop-2026-03-08` — vecchio HEAD `develop` prima del reset (su entrambi i remote).
- `archive/legacy-demo-2026-03-08` — vecchio HEAD `demo` prima del reset (su entrambi i remote).
- `archive/backup-pre-cleanup-2026-05-04` — vecchio branch `backup/pre-cleanup-2026-05-04` (su entrambi i remote).
- `archive/codex-followup-3-baseline-2026-05-04` — vecchio branch `codex/followup-3-baseline` (su entrambi i remote).
- `archive/codex-ds-panel-unification-wave-2026-03-19` — punta al commit unico `cedca764` (`Harden security and enforce tenant scope across API paths`) del branch locale (su entrambi i remote).
- `archive/gitlab-main-pre-cleanup-2026-05-05` — vecchio HEAD `gitlab/main` (solo gitlab).

## Azioni manuali residue (richiedono UI o token elevato)

1. **Branch protection**: applicare a `develop` e `demo` su GitHub (e GitLab dove serve) le stesse regole di `main` (review obbligatoria + status check `followup-3.0-ci-cd` e `followup-3.0-security`).
2. **Cleanup worktree codex**: chiudere il worktree `~/.codex/worktrees/60e9/tecma` per liberare il branch locale `codex/ds-panel-unification-wave`.
3. **GitLab `main`**: decidere se sbloccare la protection per allineare a `e835397f` o tenere lo sync branch.
