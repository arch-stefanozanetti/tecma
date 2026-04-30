# Workflow Git: branch, Pull Request, pulizia

## Nomi

- **GitHub:** **Pull Request (PR)** — richiesta di integrazione verso `main` (o altro branch base).
- **GitLab:** **Merge Request (MR)** — stesso concetto.

## Flusso consigliato (Followup 3.0 / monorepo `tecma`)

1. Creare un **branch** da `main` aggiornato: `git checkout main && git pull && git checkout -b feature/nome-descrittivo`.
2. Sviluppare e pushare sul remoto: `git push -u origin feature/nome-descrittivo`.
3. Aprire una **PR** verso `main`, descrizione chiara, link a issue/Jira se presente.
4. **Review** e CI verdi.
5. **Merge** (preferibile *squash* o *merge commit* secondo convenzione team — allinearsi al resto del repo).
6. **Dopo il merge:** eliminare il branch sul remoto dalla UI GitHub (“Delete branch” sulla PR) per evitare branch obsoleti.

## Branch locale

Dopo merge:

```bash
git checkout main
git pull
git branch -d feature/nome-descrittivo
```

## Archiviare vs cancellare

- **Cancellare** il branch remoto dopo merge è la **best practice** per pulizia: lo SHA resta nella history (`main` e merge commit).
- **Tag di archivio** (opzionale): se serve audit o ripristino rapido del tip del branch prima della cancellazione:

```bash
git tag archive/feature-nome-YYYY-MM-DD <sha-tip-branch>
git push origin archive/feature-nome-YYYY-MM-DD
```

Poi eliminare il branch remoto. Non usare tag di massa senza policy: preferire pochi tag significativi.

## Branch lunghi (es. Keycloak)

- Tenere il branch **`feature/keycloak-migration`** (o equivalente) allineato a `main` con **merge** o **rebase** periodici per ridurre conflitti.
- Quando pronto, una **unica PR** (o PR a step se il team preferisce slice) verso `main`, poi delete branch.
