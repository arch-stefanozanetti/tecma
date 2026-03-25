# Roadmap DevSecOps — piattaforma “quasi enterprise”

**Data:** 2026-03-24  
**Scope:** Tecma / FollowUp 3.0 — oltre la pipeline modulare (Semgrep, OSV, Trivy, aggregatore).  
**Non sostituisce:** [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) (piano operativo unico); questo documento è **riferimento security** per KPI, threat model esteso, supply chain, perimetro e vendor.

**Riferimenti operativi:** [SECURITY_RUNBOOK.md](../SECURITY_RUNBOOK.md) (policy giornaliere, §8–9 pipeline, §10 KPI e link qui).

---

## 1) KPI misurabili (al posto di “sicurezza al 99,9%”)

L’obiettivo **non** è una percentuale ingegneristica ambigua, ma **soglie verificabili** e **evidenze** (ticket, log, report, esiti test).

| Area | KPI suggerito (esempio) | Evidenza / misura |
|------|-------------------------|-------------------|
| **Vulnerabilità** | Critical: remediation entro **7 gg lavorativi**; High: entro **30 gg** (salvo risk acceptance firmata) | Code scanning + OSV gate; issue Jira con SLA |
| **Dipendenze runtime** | **0** advisory **High+** non mitigati su dipendenze **ship** in prod | `npm audit --omit=dev` / `pnpm audit --prod` in CI |
| **Segreti** | **0** secret noti in repo; rotazione entro **24h** da leak | `check-no-secrets`, runbook §1 |
| **Controlli applicativi** | Target **OWASP ASVS** (es. livello 2 per area esposta); mappatura aggiornata **1×/anno** | Checklist + review architettura |
| **Disponibilità / DR** | **RTO/RPO** documentati per servizi critici; test restore **≥1×/semestre** | Runbook DR, esito game day |
| **Incidenti** | **MTTD/MTTR** interni definiti (es. P1 entro X ore); post-mortem entro **5 gg** | Template incident, Confluence/Jira |
| **Supply chain** | **SBOM** CycloneDX per BE+FE a ogni release security workflow (artifact) | Artifact `followup-sbom` in Actions |
| **Accessi** | Review permessi cloud/IAM **trimestrale** su account produzione | Export + ticketing |

**Governance:** ogni eccezione (risk acceptance) ha **owner**, **motivo**, **data di revisione**.

---

## 2) Threat model esteso e inventario asset (template)

Complementare al §6 del runbook (auth, tenant, SSE, CORS). Compilare e aggiornare **almeno 1×/anno** o a cambio architettura.

### 2.1 Asset critici (inventario)

| ID | Servizio / componente | Dati / impatto | Ambiente | Owner |
|----|------------------------|----------------|----------|-------|
| A1 | `be-followup-v3` API | PII clienti, token, workspace | stg/prod | *da compilare* |
| A2 | `fe-followup-v3` | Sessione browser, chiamate API | stg/prod | *da compilare* |
| A3 | MongoDB / datastore | Persistenza tenant | stg/prod | *da compilare* |
| A4 | Render (o altro host) | Segreti runtime, networking | prod | *da compilare* |
| A5 | Integrazioni (BSS, Twilio, …) | Credenziali, webhook | prod | *da compilare* |
| A6 | Repository `tecma` | Codice, CI, SARIF | GitHub | *da compilare* |

### 2.2 Trust boundaries

- **Browser ↔ FE:** HTTPS, cookie/storage policy, CSP dove applicabile.
- **FE ↔ BE:** JWT header-only; rate limit; schema validazione.
- **BE ↔ DB / servizi esterni:** rete privata o TLS; secret manager; least privilege.
- **CI ↔ cloud deploy:** preferire **OIDC** (vedi §3), evitare PAT statiche a lunga durata.

### 2.3 Scenari prioritari (STRIDE sintetico)

| Scenario | Mitigazione già in atto | Gap tipico |
|----------|-------------------------|------------|
| IDOR / cross-tenant | `canAccess`, route guards, CI `check:route-guards` | Nuove route senza guard |
| Token leak (URL/log) | Policy JWT solo header | Logging PII/token |
| Dependency takeover | OSV + audit + SBOM | Pinning versioni, review transitive |
| Infra misconfig | Trivy fs | Policy-as-code su cloud reale |
| Abuse API / DDoS L7 | Rate limit BE | WAF / edge (§5) |

---

## 3) Secrets e identità CI/CD (OIDC)

### 3.1 Principi

- **Nessun** segreto cloud a lunga scadenza in `GitHub Secrets` se esiste **OIDC** verso il provider (AWS, Azure, GCP, ecc.).
- **Render:** oggi deploy spesso via **API key / hook**; valutare **Deploy Hook** limitati per ambiente + rotazione; documentare in [RENDER_DEPLOY.md](../RENDER_DEPLOY.md) chi aggiorna i token.
- **GitHub Actions → cloud:** usare `id-token: write` e ruolo federato; vedi frammento in [github-oidc-deploy.example.yml](../github-oidc-deploy.example.yml).

### 3.2 Checklist operativa

- [ ] Inventario di tutti i segreti in GitHub / Render / MongoDB Atlas (solo metadati, non valori).
- [ ] Rotazione calendarizzata (es. trimestrale per chiavi manuali).
- [ ] Blocco stampa segreti nei log CI (masking); review step che echo env.
- [ ] Accesso produzione: MFA, minimo privilegio, niente account condivisi senza audit.

---

## 4) SBOM, provenance e firma immagini

### 4.1 SBOM in CI

- Job **`sbom`** nel workflow [followup-3.0-security.yml](../../../../../.github/workflows/followup-3.0-security.yml): genera **CycloneDX JSON** per `be-followup-v3` e `fe-followup-v3` tramite **Trivy** (stesso tooling della pipeline).
- Artifact: **`followup-sbom`** (`sbom-be.cdx.json`, `sbom-fe.cdx.json`).
- Locale: `npm run security:sbom` (richiede `trivy` nel PATH) → `scripts/security/generate-sbom.sh`.

### 4.2 Provenance / firma (maturità successiva)

- **SLSA / attestazioni:** generazione in CI con `actions/attest-build-provenance` o equivalente quando il team adotta artifact registry con policy.
- **Cosign (immagini Docker):** firmare immagini in `docker build` release; policy in cluster/registry “accetta solo firmate”. Procedura da attivare quando le immagini sono il veicolo ufficiale di deploy (oggi molto stack è PaaS).

---

## 5) WAF, protezione API e rate limit

### 5.1 Allineamento

- **Rate limit e Helmet** già citati nel runbook (threat model §6).
- **OpenAPI / gateway Tecma:** validazione schema e auth uniforme sugli entrypoint esposti (cfr. linee guida API interne).

### 5.2 Perimetro pubblico (scelta infrastrutturale)

| Opzione | Quando ha senso | Note |
|---------|-----------------|------|
| **WAF gestito** (Cloudflare, AWS WAF, Fastly, …) | Traffico pubblico elevato, bot, necessità regole geografiche | Davanti a Render/custom domain |
| **API Gateway** con throttling | API B2B / partner | Allineare quota a OpenAPI |
| **Solo app rate limit** | MVP / basso rischio | Adeguare prima di obblighi contrattuali |

**Azione:** definire **owner infrastruttura**, **dominio** e **piano** (staging prima). Documentare regole minime: blocchi path noti, limiti richieste, header sicurezza a edge.

---

## 6) Matrice vendor — ASPM (es. Aikido) vs enterprise

Usare come **checklist RFP/POC**, non come giudizio su singolo fornitore (i prodotti evolvono).

| Criterio | Peso tipico | Domanda da porre |
|----------|-------------|------------------|
| **SSO / SAML / OIDC** | Alto | Supporto IdP aziendale, enforcement MFA |
| **SCIM / provisioning** | Medio-alto | On/off boarding utenti tool |
| **Audit log esportabili** | Alto | Verso SIEM, retention, immutabilità |
| **Residency dati (EU)** | Alto se GDPR strict | Regione hosting, DPA |
| **Certificazioni** | Alto enterprise | SOC 2 Type II, ISO 27001, pen test fornitore |
| **Integrazioni** | Medio | Jira, Slack, GitHub, ServiceNow |
| **RBAC nel prodotto** | Medio | Ruoli admin vs viewer, separazione tenant |
| **Export findings** | Alto | SARIF, API, lock-in |
| **SLA / supporto** | Medio | Tempi risposta, canale dedicato |
| **Deployment** | Variabile | SaaS only vs VPC / on-prem |

**Confronto approcci**

1. **ASPM unificato** (classe Aikido): visibilità unica, meno tool fatigue; valutare profondità per dominio e export.
2. **Best-of-breed:** massima profondità; costo integrazione più alto.
3. **Suite enterprise:** compliance pack e supporto; costi e tempi di adozione.

**Raccomandazione:** POC su **1–2 repo + 1 ambiente**; in parallelo mantenere **policy-as-code** e **SARIF/JSON** (come già su GitHub).

---

## 7) Prossimi passi operativi (priorità)

1. Approvare i **KPI** in §1 (numeri e SLA) in riunione security/prodotto.  
2. Compilare l’**inventario asset** §2.1 e collegarlo al threat model §6 runbook.  
3. Eseguire checklist **OIDC/secrets** §3; aprire task per ogni segreto long-lived rimasto.  
4. Scaricare artifact **SBOM** dalla prima run green e archiviarli (Confluence / GRC).  
5. Decisione **WAF/edge** §5 con owner e timeline staging.  
6. Completare **matrice vendor** §6 per eventuale acquisto ASPM.

---

*Documento derivato dal piano “DevSecOps oltre 99,9%” e revisione governance; aggiornare la data in calce a ogni revisione sostanziale.*
