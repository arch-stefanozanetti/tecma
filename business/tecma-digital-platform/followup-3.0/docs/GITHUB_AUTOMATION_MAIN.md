# GitHub: portare il codice su `main` senza usare la UI delle Pull Request

Su questo repository **`main` è protetto**: di solito non puoi fare solo `git push origin main` finché le regole del branch lo richiedono (PR + check CI).

Non devi “sapere fare le PR a mano”: hai **due strade automatiche**.

---

## Opzione A — Un solo comando (consigliata)

Dalla **root del monorepo `tecma`**:

1. **Una tantum**, autenticazione GitHub CLI:
   ```bash
   gh auth login
   ```
   Segui le istruzioni (browser o token). Chi ha il repo può usare un **Personal Access Token** con scope `repo`.

2. Lavori su un branch (es. `feature/mia-modifica`), commit fatti.

3. Esegui:
   ```bash
   bash scripts/gh-promote-to-main.sh
   ```

Lo script fa in sequenza: **push del branch → crea la PR verso `main` se non esiste → merge** (prova prima con **bypass admin** se il tuo utente è owner; altrimenti **aspetta che i check CI siano verdi** e poi merge).

Non devi aprire GitHub nel browser per creare o mergiare la PR.

**Variante** (solo merge dopo CI, mai bypass):

```bash
bash scripts/gh-promote-to-main.sh --no-admin
```

---

## Opzione B — Zero PR nel flusso Git (solo owner del repo)

Se vuoi proprio evitare che GitHub richieda una PR:

1. Su **GitHub** → repository **tecma** → **Settings** → **Rules** → **Rulesets** (o *Branch protection rules* a seconda della UI).
2. Modifica la regola su **`main`**: disattiva **“Require a pull request before merging”** (e valuta se mantenere i check obbligatori in altro modo).
3. In locale:
   ```bash
   git checkout main
   git merge <tuo-branch>
   git push origin main
   ```

Solo un **amministratore** del repository può cambiare quelle impostazioni. È una scelta di governance: meno frizione, più responsabilità sul push diretto.

---

## Cursor / agente AI

Puoi chiedere all’agente: *“porta questo lavoro su main”*. Se l’agente ha il **GitHub MCP** configurato, può creare e mergiare la PR al posto tuo (come già fatto per il merge dell’hub executive), senza che tu apra la UI.

In parallelo, **Opzione A** ti rende autonomo da terminale con `gh`.

---

## Riferimenti

- Script: [`scripts/gh-promote-to-main.sh`](../../../../scripts/gh-promote-to-main.sh) (path dalla root `tecma`).
- CI FollowUp: `.github/workflows/` nella root `tecma`.
