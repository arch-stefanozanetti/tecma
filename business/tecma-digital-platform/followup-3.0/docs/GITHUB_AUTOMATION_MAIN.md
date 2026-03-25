# GitHub: portare il codice su `main` senza usare la UI delle Pull Request

Hai **due scenari** sul repository **tecma**: `main` **non protetto** oppure **protetto** (PR e/o check obbligatori). Scegli il blocco che corrisponde alla tua situazione attuale.

Non devi “sapere fare le PR a mano”: con `main` non protetto basta **push diretto**; con `main` protetto usa **script** o **agente**.

---

## `main` non protetto (push diretto)

Se in **Settings → Rules / Branch protection** non richiedi più PR su `main`, GitHub accetta:

```bash
git checkout main
git pull origin main
git merge <tuo-branch>    # oppure già committi su main
git push origin main
```

È il flusso **più semplice**: nessuna PR, nessuna UI GitHub. Le **Actions** possono comunque partire sul push su `main` (vedi workflow in `.github/workflows/`), ma non bloccano il push.

**Attenzione:** ogni `git push origin main` pubblica subito; conviene sempre `git pull` prima del push e, se possibile, provare in locale.

Se GitHub risponde con **GH006** / *Protected branch update failed*, la protezione su `main` è **ancora attiva** (anche se la UI può confondere tra *Rulesets* e *Branch protection*): controlla **Settings → Rules** del repository oppure passa alla sezione **[`main` protetto](#main-protetto-pr-obbligatoria-da-cli-o-agente)** qui sotto.

---

## `main` protetto (PR obbligatoria da CLI o agente)

Se `main` è di nuovo protetto, di solito **non** basta `git push origin main` senza passare da PR (o da bypass admin).

### Opzione A — Un solo comando (consigliata con protezione attiva)

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

### Opzione B — Togliere la protezione (solo owner)

Se vuoi tornare al flusso **senza PR** lato GitHub:

1. Su **GitHub** → repository **tecma** → **Settings** → **Rules** → **Rulesets** (o *Branch protection rules*).
2. Modifica o rimuovi la regola su **`main`** (es. disattiva **“Require a pull request before merging”**).

Poi usa la sezione **[`main` non protetto](#main-non-protetto-push-diretto)** sopra.

Solo un **amministratore** del repository può cambiare quelle impostazioni. È una scelta di governance: meno frizione, più responsabilità sul push diretto.

---

## Cursor / agente AI

Puoi chiedere all’agente: *“porta questo lavoro su main”*. Se l’agente ha il **GitHub MCP** configurato, può creare e mergiare la PR al posto tuo quando `main` è protetto, senza che tu apra la UI.

Con **`main` non protetto**, l’agente può limitarsi a **commit + `git push origin main`** (dopo `pull`).

---

## Riferimenti

- Script (branch protetto): [`scripts/gh-promote-to-main.sh`](../../../../scripts/gh-promote-to-main.sh) (path dalla root `tecma`).
- CI FollowUp: `.github/workflows/` nella root `tecma`.
