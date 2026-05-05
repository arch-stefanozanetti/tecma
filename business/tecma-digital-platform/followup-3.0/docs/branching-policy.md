# Branching Policy — followup-3.0

Versione vigente dal **2026-05-05**. Allineata alle workspace rules
`git-branching-environments`, `testing-definition-of-done` e
`workflow-orchestration`.

## 1. Long-lived branches

| Branch    | Ruolo                       | Ambiente         | Note                                                   |
| --------- | --------------------------- | ---------------- | ------------------------------------------------------ |
| `main`    | Produzione (= `prod`)       | MongoDB **prod** | Deploy automatico via GitLab CI (`CI_DEFAULT_BRANCH`). |
| `demo`    | Demo / staging              | MongoDB **demo** | Deploy demo via `.gitlab/ci/deploy-demo.yml`.          |
| `develop` | Integrazione team (= `dev`) | MongoDB **dev1** | Deploy dev1 via `.gitlab/ci/deploy-dev1.yml`.          |

> Vietato lavorare direttamente su questi branch. Sempre branch funzionali
> temporanei.

## 2. Branch funzionali (temporanei)

Naming obbligatorio:

- `feat/<area>-<slug>` — nuova funzionalità.
- `fix/<area>-<slug>` — correzione bug.
- `chore/<slug>` — manutenzione/lavori non funzionali.
- `hotfix/<slug>` — fix urgente che parte da `main` (vedi §5).

Regole:

1. **Scope chiuso**: un branch tocca **una sola area** (RBAC, audit,
   error-handling, mail, design-system, ecc.). Se ti accorgi di sconfinare,
   apri un nuovo branch.
2. **Vita breve**: il branch deve durare massimo qualche giorno. Branch >30
   giorni senza commit vengono segnalati dall'automation `stale-branches`.
3. **Push frequente**: pushare almeno una volta al giorno per non perdere
   lavoro e abilitare review continua.
4. **Cleanup post-merge**: dopo il merge, il branch è cancellato **subito**
   sia in locale sia su tutti i remote (vedi §6 — automation).

## 3. Merge flow

```
feat|fix|chore/* ──► develop ──► demo ──► main
hotfix/*         ──► main    (back-merge in develop subito dopo)
```

In assenza di ambienti staging configurati pienamente, è ammesso il merge
diretto `feat|fix|chore/* ──► main` con allineamento successivo di
`develop` e `demo` (situazione corrente — vedi `branches-parking-2026-05-05.md`).

## 4. Definition of Done per il merge

Allineata a `testing-definition-of-done`:

- [ ] Tutti i test unit del package toccato verdi.
- [ ] Test integration verdi (per API/DB/auth).
- [ ] Test e2e Playwright (per UI critical path) verdi in CI.
- [ ] Test security/hardening dove applicabili.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm lint:openapi` zero errori.
- [ ] Coverage ≥ baseline del package toccato.
- [ ] Comandi e esiti **citati nella descrizione PR**.
- [ ] Branch cancellato locale + tutti i remote dopo merge.

## 5. Hotfix

- Parte da `main` (`git checkout main && git checkout -b hotfix/<slug>`).
- Dopo merge in `main`, **back-merge** immediato in `develop` (e `demo` se
  serve) per evitare regressioni.
- Tag rilascio se il fix esce subito in produzione.

## 6. Cleanup branch — policy + automation

- **Cleanup post-merge**: cancellazione immediata del branch sorgente dopo
  merge (locale + remote usati dal team).
- **Stale-branch report**: controllo settimanale su branch >30 giorni senza
  commit, con apertura ticket interno di review.
- **Archiviazione manuale**: per branch con commit unici da non perdere ma
  da rimuovere, prima `git tag archive/<branch>-<YYYY-MM-DD> <branch>` poi
  `git branch -D <branch>` + `git push <remote> --delete <branch>`.

## 7. Doppio remote (`origin` + `gitlab`)

- `origin` è il remote primario per lo sviluppo.
- `gitlab` è il remote operativo per CI/CD interna (deploy dev1/demo/prod).
- Quando si crea o si cancella un branch funzionale, replicare su entrambi i
  remote se il branch deve essere visibile alla CI GitLab.
- `gitlab/main` ha **branch protection** che blocca force push: se serve
  resync, usare un branch `sync/from-main-<YYYY-MM-DD>` e gestire da UI
  GitLab.

## 8. Eccezioni

Eccezioni alla policy (es. branch sperimentali long-running, spike) vanno
tracciate in `docs/branches-parking-<data>.md` con data di review e owner.

## 9. Riferimenti

- [`testing-definition-of-done.mdc`](../../../.cursor/rules/testing-definition-of-done.mdc)
- [`git-branching-environments.mdc`](../../../.cursor/rules/git-branching-environments.mdc)
- [`workflow-orchestration.mdc`](../../../.cursor/rules/workflow-orchestration.mdc)
- [`branches-parking-2026-05-05.md`](./branches-parking-2026-05-05.md)
