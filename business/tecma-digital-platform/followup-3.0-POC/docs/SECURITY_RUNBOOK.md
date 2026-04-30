# Security Runbook — Followup 3.0

## 1) Immediate secret leak response
- Revoke compromised credentials immediately (MongoDB URI user, SMTP/API tokens).
- Rotate secrets in secret manager / deployment platform.
- Validate all environments (dev/stage/prod) use rotated values.
- Audit access logs around leak window.

## 2) Repository hardening policy
- Never commit real credentials in `.env*`, docs, scripts, fixtures.
- Keep only placeholders in tracked files (`.env.example`).
- Use `npm run check:secrets` before every push.
- Enable local git hook once per clone:
  - `npm run setup:githooks`

## 3) CI controls
- `scripts/check-no-secrets.sh` is mandatory and blocking in CI.
- PRs fail on potential hardcoded secrets.
- No bypass except repository admin emergency hotfix with post-incident review.
- **Audit dipendenze (policy Followup 3.0):**
  - **BE** (`ci-be.yml`): bloccante `npm audit --omit=dev --audit-level=high` (solo dipendenze di runtime). Step aggiuntivo **informativo** `npm audit --audit-level=high` sull’intero albero (include devDependencies, es. Stryker): `continue-on-error: true` così la PR resta verde ma il log mostra advisory su toolchain.
  - **FE** (`ci-fe.yml`): bloccante `pnpm audit --prod --audit-level=high`. Step informativo sull’albero completo con `continue-on-error: true`.
  - DevDependencies con advisory noti vanno **tracciati** (issue o risk acceptance) e riesaminati a release / trimestralmente.

## 4) Deployment checklist
- Confirm required env vars are set server-side (not in repo).
- Verify `AUTH_JWT_SECRET` length/policy in staging/prod.
- Verify CORS origins are explicit and valid.
- Run smoke tests for auth/login and portal routes after deploy.

## 5) Incident closure checklist
- Root cause documented.
- Blast radius documented.
- Rotations completed and validated.
- CI/guardrails updated if detection missed.

---

## 6) Threat model (minimo)

- **Autenticazione:** JWT (access + refresh); token solo in header `Authorization`. Nessun token in query/URL. Sessioni portal e BSS gestite con token dedicati.
- **Tenant isolation:** Tutte le API che accettano `workspaceId`/`projectId` devono passare dal middleware `requireCanAccessWorkspace`/`requireCanAccessProject` (controllo centralizzato in `canAccess`). Allowlist per route pubbliche in `docs/ROUTE_ACCESS_ALLOWLIST.md`. CI `check:route-guards` blocca route senza guardia.
- **Realtime (SSE):** Token solo da header; `workspaceId`/`projectId` validati con `canAccess` prima di aprire lo stream. Nessun token in query string.
- **Esposizione API:** CORS restrittivo; Helmet per header di sicurezza; rate limit e proxy trust in produzione. API pubbliche limitate a health, openapi, portal pubblico, platform (con API key).

## 7) Dependency risk e vulnerability

- **Runtime vs dev:** la barra “verde” in CI è sull’**installazione di produzione** (BE: `npm audit --omit=dev`; FE: `pnpm audit --prod`), severità **high+**. Le devDependencies restano visibili nello step audit “informativo” e vanno gestite come sopra §3.
- Eseguire regolarmente anche in locale `npm audit` / `pnpm audit` prima di release importanti.
- **Import Excel unità (BE):** parsing con `read-excel-file` (sostituisce il pacchetto `xlsx` deprecato dal punto di vista advisory).
- **serialize-javascript (FE, transitiva):** monitorare aggiornamenti della catena. In caso di high non risolvibile nel solo albero `--prod`, valutare override o risk acceptance (owner, scadenza review).
- Prima di dichiarare “enterprise-ready”: nessun **high+** non mitigato sulle dipendenze **effettivamente ship** (runtime); per dev/tooling, risk acceptance esplicita se persistente.

---

## 8) Pipeline modulare DevSecOps (Semgrep, OSV, Trivy, aggregatore)

Obiettivo: sostituire tool “black box” con output **JSON trasparenti**, normalizzati e utilizzabili in CI e su PR.

### Dove vive il codice

- Aggregatore TypeScript: `security-aggregator/` (build: `npm ci && npm run build`, CLI: `node dist/cli.js`).
- Config: `.semgrep.yml`, `.semgrepignore`, `.trivyignore` nella root del package `followup-3.0`.
- Script locale (richiede `semgrep`, `osv-scanner`, `trivy` nel PATH): `npm run security:modular` → `scripts/security/run-scans.sh`.
- Report generati (non committare): cartella `security-reports/` (già in `.gitignore`).

### CI (monorepo `tecma`)

- Workflow principale: `.github/workflows/followup-3.0-security.yml` (root repo).
- Job paralleli: Semgrep (`p/ci`), OSV Scanner v2 (`osv-scanner scan source -r .`), Trivy (`trivy fs` vuln + misconfig).
- Job **aggregate**: unisce i JSON in `unified-report.json` e `summary.json`, pubblica artifact, opzionalmente commento PR (sticky, marker `<!-- security-report-bot -->` nel body).
- **Gate**: fallisce la run se `critical > FAIL_ON_CRITICAL_GT` o `high > FAIL_ON_HIGH_GT` (variabili d’ambiente, default `0` nel workflow). Per una fase di rodaggio si può alzare temporaneamente `FAIL_ON_HIGH_GT` nel file workflow (es. `5`), con issue di tracking per riportare a `0`.
- **UI senza sviluppo su FollowUp:** ogni job scanner genera anche **SARIF** e lo carica con `github/codeql-action/upload-sarif` (categorie `followup-semgrep`, `followup-osv`, `followup-trivy-fs`). In GitHub: **Security → Code scanning** (o **Code security** a seconda della UI) per filtri, stato e storico. Non serve Grafana né una pagina nell’app React.
  - **Repo pubblici:** Code scanning da SARIF di terze parti è di norma incluso.
  - **Repo privati:** spesso serve **GitHub Advanced Security** (licenza) per usare Code scanning in modo completo; verificare il piano dell’organizzazione.
  - **PR da fork:** GitHub non accetta upload SARIF da fork verso il repo base: gli step di upload sono condizionati e usano `continue-on-error: true` dove serve.

### Grafana (e perché non è il default qui)

- **Grafana OSS** è **gratuito** (licenza AGPL), ma è pensato per **metriche e log** (Prometheus, Loki, ecc.). Farci entrare i finding statici come il nostro `unified-report.json` richiede comunque **integrazione** (metriche derivate, Loki, plugin, ecc.) — cioè lavoro che sostituisce o duplica ciò che GitHub offre già per i SARIF. Per questo la scelta consigliata nel monorepo `tecma` è **GitHub Code Scanning**, non una dashboard Grafana dedicata a questi scan.

### Comandi aggregatore

```bash
cd security-aggregator && npm ci && npm run build
cd ..
node security-aggregator/dist/cli.js aggregate \
  --out-dir security-reports \
  --semgrep security-reports/semgrep-report.json \
  --osv security-reports/osv-report.json \
  --trivy security-reports/trivy-report.json \
  --pr-body-out security-reports/pr-body.md
```

- `--soft-fail`: non esce con codice 1 se il gate fallisce (utile per generare comunque `pr-body.md` prima dello step `gate`).
- `node security-aggregator/dist/cli.js gate --summary security-reports/summary.json`: applica solo le soglie `FAIL_ON_*`.

### Opzionale (manuale)

- `.github/workflows/followup-3.0-security-optional.yml`: **workflow_dispatch** — ZAP baseline su URL staging; build Docker BE + `trivy image`. Non blocca la CI principale.

### GitLab (parità opzionale)

- Esempio commentato da adattare: [docs/gitlab-security-pipeline.example.yml](gitlab-security-pipeline.example.yml) — stessi tool e aggregatore; path e `include:` dipendono dal layout del repo GitLab.

### Disabilitazione temporanea

- Non rimuovere i gate senza issue: aprire ticket con owner, motivo e data di review.
- Per rumore eccessivo Semgrep: stringere `.semgrepignore` / regole in `.semgrep.yml` o passare solo `p/ci` (già default in CI).

### Dashboard HTML (navigabile e condivisibile)

- Dopo l’aggregazione, la CI genera **`security-reports/security-dashboard.html`**: pagina **autonoma** (dark mode, filtri per severità/tool, ricerca testuale, stampa/PDF dal browser).
- **Dove trovarla:** GitHub → **Actions** → run *FollowUp 3.0 Security* → artifact **`security-unified-followup3`** (insieme a `unified-report.json` e `summary.json`). Scarica lo zip, apri `security-dashboard.html` in Chrome/Firefox/Safari.
- **Condivisione:** allega il file a **Confluence**, **Jira**, email, o caricalo su uno **spazio documenti** interno. Non è un URL pubblico finché non pubblichi lo stesso file su **GitHub Pages**, un bucket S3 con accesso controllato, o un portale compliance — va valutato con IT/security.
- **Locale:** dopo `npm run security:modular`, il file è in `security-reports/` (cartella gitignored).
- Comando diretto: `node security-aggregator/dist/cli.js dashboard --report security-reports/unified-report.json --out security-reports/security-dashboard.html`.

---

## 9) Penetration test, DAST e cosa copre oggi la pipeline

| Attività | Stato in FollowUp 3.0 | Note |
|----------|------------------------|------|
| **SAST** (codice) | Semgrep in CI + SARIF su GitHub | Non trova problemi di sola infrastruttura o logica business complessa. |
| **SCA** (dipendenze) | OSV + audit npm/pnpm in CI | Copre CVE note su lockfile; non sostituisce review manuale delle dipendenze. |
| **IaC / fs** | Trivy `fs` (vuln + misconfig) | Dockerfile, config esposte nel repo; non è audit del cloud account. |
| **DAST automatico** | **Opzionale:** workflow [followup-3.0-security-optional.yml](../../../.github/workflows/followup-3.0-security-optional.yml) — **ZAP baseline** su URL staging (`workflow_dispatch`) | È uno **smoke** automatizzato (surface comune OWASP), **non** un penetration test completo. |
| **Penetration test professionale** | **Non in pipeline:** va **pianificato** con fornitore interno/esterno | Tipicamente 1×/anno o a release major, scope su **staging** (e solo prod con accordi), report + retest dopo i fix. |

**Messaggio per stakeholder:** la pipeline riduce il rischio regressione e CVE note; **non** elimina la necessità di un **pentest** quando policy, clienti enterprise o normativa lo richiedono. Il **ZAP baseline** è un complemento utile, non l’equivalente di un red team o di un pentest metodologico (catene di attacco, privilege escalation, logica di dominio, social engineering, ecc.).

**Prossimi passi tipici (fuori da questo repo):** definire frequenza e fornitore del pentest, allineare scope a staging URL già usati per ZAP, tracciare finding in Jira e collegarli al release train.

### Esempi di output

- `security-aggregator/examples/unified-report.example.json`
- `security-aggregator/examples/summary.example.json`

---

## 10) Roadmap “quasi enterprise”, KPI e SBOM

**Messaggio chiave:** non esiste una metrica ingegneristica tipo “sicurezza al 99,9%”. Si lavora con **KPI misurabili** (SLA remediation, DR, controlli), **defense in depth** e **evidenze** per audit e clienti enterprise.

| Cosa | Dove |
|------|------|
| **KPI, threat model esteso, inventario asset, OIDC/secrets, WAF, matrice vendor ASPM** | [docs/plans/2026-03-24-devsecops-enterprise-roadmap.md](plans/2026-03-24-devsecops-enterprise-roadmap.md) |
| **Esempio OIDC GitHub → cloud** (snippet, non workflow attivo) | [docs/github-oidc-deploy.example.yml](github-oidc-deploy.example.yml) |
| **SBOM CycloneDX in CI** | Job **SBOM (CycloneDX)** in `.github/workflows/followup-3.0-security.yml` → artifact **`followup-sbom`** |
| **SBOM in locale** | `npm run security:sbom` (richiede [Trivy](https://aquasecurity.github.io/trivy/latest/getting-started/installation/) nel PATH) → `security-reports/sbom-*.cdx.json` |

Allineare priorità e owner in backlog/Jira; aggiornare la roadmap quando cambiano stack o requisiti contrattuali.

---

## 11) Esecuzione penetration test (operativa)

Per passare da “DAST opzionale” a pentest reale:

1. Baseline interna rapida:
   - `TARGET_URL="https://staging.example.com" npm run security:zap:baseline`
2. Preparazione fornitore con template:
   - [PENTEST_VENDOR_HANDOFF.md](PENTEST_VENDOR_HANDOFF.md)
3. Playbook completo:
   - [PENTEST_EXECUTION.md](PENTEST_EXECUTION.md)

Output minimi da archiviare:

- report tecnico finale,
- lista finding con severita' e PoC,
- piano remediation con owner/SLA,
- retest di chiusura.
