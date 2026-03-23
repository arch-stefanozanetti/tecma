# Backup manuale: GitHub → GitLab

Questo documento descrive come tenere allineato il repository **GitHub** (`origin`) con il progetto GitLab aziendale usato come **backup**, senza sostituire per ora la fonte di lavoro quotidiana.

Progetto GitLab di riferimento: [experimental/followup3.0](https://gitlab.tecmasolutions.com/business/tecma-digital-platform/experimental/followup3.0) (HTTPS: `https://gitlab.tecmasolutions.com/business/tecma-digital-platform/experimental/followup3.0.git`).

## Attenzione: layout del repository

Il clone collegato a `origin` è il **monorepo `tecma`** (root = intero albero del repo GitHub). Il progetto GitLab storico *Followup3.0* può aver avuto un layout diverso (es. cartelle `design-system/` e `followup-3.0/` in root).

Un `git push gitlab --all` invia la **stessa history e la stessa root** del repo locale: su GitLab comparirà l’albero del monorepo GitHub (es. `business/tecma-digital-platform/...`), non una sottocartella rinominata. Se serve invece solo il sottoalbero Followup 3.0 con struttura “vecchia”, non usare questo mirror diretto: servono `git subtree`, un secondo clone filtrato, o un progetto GitLab dedicato al monorepo intero.

## Prerequisiti

- Ruolo sul progetto GitLab che consenta **push** sui branch che vuoi aggiornare (es. Developer/Maintainer, in assenza di branch protection troppo restrittive).
- Autenticazione (scegline una):
  - **HTTPS + Personal Access Token** (GitLab → *Preferences* → *Access Tokens*): scope **`write_repository`** (o equivalente che includa push).
  - **SSH**: chiave pubblica aggiunta al profilo GitLab e remote `gitlab` in forma `git@gitlab.tecmasolutions.com:business/tecma-digital-platform/experimental/followup3.0.git`.

## Remote `gitlab` nel clone locale

Nel repository alla root del monorepo `tecma` dovresti avere:

```bash
git remote -v
# origin   → github.com/arch-stefanozanetti/tecma.git
# gitlab   → https://gitlab.tecmasolutions.com/business/tecma-digital-platform/experimental/followup3.0.git
```

Se `gitlab` non c’è, aggiungilo senza toccare `origin`:

```bash
git remote add gitlab https://gitlab.tecmasolutions.com/business/tecma-digital-platform/experimental/followup3.0.git
```

Per usare SSH al posto di HTTPS:

```bash
git remote set-url gitlab git@gitlab.tecmasolutions.com:business/tecma-digital-platform/experimental/followup3.0.git
```

## Prima sincronizzazione (tutti i branch e i tag)

Dalla root del clone (`tecma`):

```bash
git fetch origin
git push gitlab --all
git push gitlab --tags
```

Se su GitLab esiste già una history **divergente** e vuoi sostituirla con quella di GitHub (solo se accetti di sovrascrivere il remoto GitLab in linea con la policy del team):

```bash
git push gitlab --all --force-with-lease
git push gitlab --tags --force-with-lease
```

`--force-with-lease` è più sicuro di `--force` perché rifiuta il push se qualcuno ha aggiornato GitLab nel frattempo.

### HTTPS senza prompt (token in variabile, solo da sessione locale)

Esempio (non committare il token; non loggare l’URL con token):

```bash
export GITLAB_TOKEN='glpat-xxxxxxxx'   # PAT con write_repository
git push "https://oauth2:${GITLAB_TOKEN}@gitlab.tecmasolutions.com/business/tecma-digital-platform/experimental/followup3.0.git" --all
git push "https://oauth2:${GITLAB_TOKEN}@gitlab.tecmasolutions.com/business/tecma-digital-platform/experimental/followup3.0.git" --tags
unset GITLAB_TOKEN
```

In alternativa, configura il **credential helper** di Git per `gitlab.tecmasolutions.com` e usa i comandi `git push gitlab ...` normali.

## Routine dopo il lavoro su GitHub

1. Push su GitHub come sempre: `git push origin <branch>`.
2. Backup su GitLab:
   - **Solo il branch corrente:** `git push gitlab HEAD:<nome-branch>`
   - **Allineamento completo periodico:** ripeti la sezione “Prima sincronizzazione” (`--all` e `--tags`).

## Verifica che GitLab sia allineato

Confronta gli hash tra `origin` e `gitlab` (dopo `git fetch origin` e `git fetch gitlab`):

```bash
git fetch origin
git fetch gitlab
git rev-parse origin/main
git rev-parse gitlab/main
```

Devono coincidere per `main` (e per ogni altro branch che specchi). Per i tag:

```bash
git ls-remote origin 'refs/tags/*' | sort
git ls-remote gitlab 'refs/tags/*' | sort
```

Sull’interfaccia GitLab controlla anche il numero di branch/tag e l’ultimo commit visibile su `main`.

## CI/CD su GitLab

Se nella **root del monorepo** su GitLab compare un `.gitlab-ci.yml` (portato da GitHub o creato sul progetto), i push su GitLab possono avviare pipeline. Per un backup “solo codice” puoi lasciare job leggeri o disabilitare le pipeline nel progetto GitLab (*Settings* → *CI/CD*) finché non migrate ufficialmente il flusso.

## Riferimenti interni

- Deploy e CI GitHub: [DOCS_CI_CD.md](DOCS_CI_CD.md), [RENDER_DEPLOY.md](RENDER_DEPLOY.md).
- Workflow GitHub monorepo: `.github/workflows/followup-3.0-ci-cd.yml` nella root del repository `tecma`.
