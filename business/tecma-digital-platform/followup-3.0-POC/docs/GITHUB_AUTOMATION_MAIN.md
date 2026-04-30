# GitHub: portare il codice su `main` senza usare la UI delle Pull Request

Su **tecma** la situazione dipende da **cosa** è attivo su `main` in **Settings → Branches → Branch protection rules** (o *Rulesets*). Non basta guardare solo «PR obbligatoria sì/no»: anche **solo i check obbligatori** cambiano il comportamento del push.

---

## 1. Nessuna regola su `main` (vero push diretto)

Solo se **non** c’è alcuna protezione che richiede check (né PR), GitHub accetta:

```bash
git checkout main
git pull origin main
git merge <tuo-branch>
git push origin main
```

Le Actions possono comunque girare sul push, ma **non** bloccano il push lato GitHub.

---

## 2. Solo «Require status checks to pass» (senza PR obbligatoria) — il tuo caso tipico

Se hai **disattivato** «Require a pull request before merging» ma lasci **attivo**:

- **Require status checks to pass before merging**, con ad esempio:
  - `FE Quality Gate`
  - `Aggregate + gate`
- (opzionale) **Require branches to be up to date before merging**

allora GitHub si comporta come scrive la UI: *i commit vanno prima su **un altro branch**; quando i check richiesti sono **verdi**, si può integrare su `main` (merge o push su `main` che soddisfa i check).*

In pratica un **`git push origin main`** con **commit nuovi** che non hanno ancora quei check **verdi** viene spesso rifiutato (**GH006**, messaggi tipo *X of Y required status checks are expected*): su quel commit i check non risultano ancora passati.

**Cosa fare (senza aprire la UI delle PR a mano):**

- Stesso flusso automatico della sezione 3: **`bash scripts/gh-promote-to-main.sh`** dalla root `tecma` (push branch → PR → merge dopo CI), oppure chiedere a un **agente con GitHub MCP** di fare PR + merge al posto tuo.

**«Require branches to be up to date»:** se resta attivo con i check, GitHub può chiedere di aggiornare il branch con l’ultimo `main` prima del merge; è normale e riduce regressioni.

**Se volessi davvero solo `git push origin main` senza passare da branch/CI:** dovresti **disattivare anche** «Require status checks to pass before merging» su `main` (scelta di governance: nessun gate obbligatorio su quel branch).

---

## 3. PR obbligatoria e/o regole aggiuntive

Se è attiva anche **«Require a pull request before merging»**, di solito **non** basta un push diretto su `main` senza PR.

### Opzione consigliata — un comando (GitHub CLI)

Dalla **root del monorepo `tecma`**:

1. **Una tantum:** `gh auth login` (browser o token con scope `repo`).
2. Branch con i commit pronti.
3. Esegui:
   ```bash
   bash scripts/gh-promote-to-main.sh
   ```
   Fa: push del branch → crea la PR verso `main` se manca → merge (eventuale bypass admin se consentito, altrimenti attende i check).

Solo merge dopo CI, senza bypass admin:

```bash
bash scripts/gh-promote-to-main.sh --no-admin
```

### Togliere le protezioni (solo owner)

In **Settings → Branches** (o Rulesets) modifica la regola su `main`: per il push diretto senza attesa check serve **non** richiedere status check su quel branch; per togliere la PR basta disattivare quella voce, ma i **check** restano il vincolo finché restano obbligatori (vedi sezione 2).

---

## Cursor / agente AI

Puoi chiedere: *«porta questo lavoro su main»*. Con MCP GitHub l’agente può creare e mergiare la PR al posto tuo. Con `main` del tutto senza regole (sezione 1), basta **commit + `git push origin main`** (dopo `pull`).

---

## Riferimenti

- Script: [`scripts/gh-promote-to-main.sh`](../../../../scripts/gh-promote-to-main.sh) (path dalla root `tecma`).
- CI FollowUp: `.github/workflows/` nella root `tecma`.
