# Documentazione Followup 3.0

Indice della documentazione di progetto. **Piano unico (checklist, fasi, backlog):** [PIANO_GLOBALE_FOLLOWUP_3.md](PIANO_GLOBALE_FOLLOWUP_3.md). Visione e wave: [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md).

---

## Panoramica per leadership (CTO / CEO)

Sezione **navigabile** (executive summary, perché rebuild, stadio operativo per dominio, architettura, GDPR alto livello, rischi): **[docs/executive/README.md](executive/README.md)**.

---

## Documenti maestro

| File | Contenuto |
|------|-----------|
| **[PIANO_GLOBALE_FOLLOWUP_3.md](PIANO_GLOBALE_FOLLOWUP_3.md)** | **Unico piano operativo:** checklist, fasi 0–8, workspace/segregazione, Millennium, AI aggregata, entitlement, dati legacy, roadmap implementativa. |
| **[FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md)** | North Star, principi, visione, cosa non fare, riferimento followup-nova, wave 1–7 in ordine vincolante, regole non negoziabili. |

### Migrazione legacy → `tz_*` (deliverable)

| File | Contenuto |
|------|-----------|
| [deliverables/CLARIFY_MIGRATION_OBJECTIVES.md](deliverables/CLARIFY_MIGRATION_OBJECTIVES.md) | Obiettivo A (dati) vs B (parità funzionale), vincoli di tempo — allineamento CTO. |
| [deliverables/LEGACY_MONGO_INVENTORY.md](deliverables/LEGACY_MONGO_INVENTORY.md) | Inventario DB/collection read-only + procedure mongosh. |
| [deliverables/FASE1_CSV_MAPPING.md](deliverables/FASE1_CSV_MAPPING.md) | Matrice mapping cliente, appartamento, quote, utenti. |
| [deliverables/RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](deliverables/RBAC_LEGACY_TO_WORKSPACE_MAPPING.md) | Ruoli legacy → workspace e progetti. |
| [deliverables/WORKFLOW_SELL_STATE_MAPPING.md](deliverables/WORKFLOW_SELL_STATE_MAPPING.md) | Stati SELL legacy → workflow e snapshot. |
| [deliverables/GDPR_CONSENT_SCOPE_SPIKE.md](deliverables/GDPR_CONSENT_SCOPE_SPIKE.md) | Spike consensi progetto vs workspace. |
| [deliverables/PILOT_ETL_RUNBOOK.md](deliverables/PILOT_ETL_RUNBOOK.md) | ETL pilota idempotente e validazione. |
| [deliverables/LEGACY_PROJECT_WORKSPACE_MAPPING.md](deliverables/LEGACY_PROJECT_WORKSPACE_MAPPING.md) | Regola ID progetto + mapping `project_id -> workspace` usato dallo script ETL. |
| [deliverables/MIGRATION_PILOT_RESULTS.md](deliverables/MIGRATION_PILOT_RESULTS.md) | Evidenza run pilota reale su `test-zanetti` con conteggi scritti. |
| [deliverables/LEGACY_ENRICHMENT_P1_P2.md](deliverables/LEGACY_ENRICHMENT_P1_P2.md) | Backlog di arricchimento post-clone (P1/P2). |
| [executive/07-legacy-migration-and-data-parity.md](executive/07-legacy-migration-and-data-parity.md) | Sintesi leadership + link ai deliverable. |

---

## Documenti di supporto

| File | Contenuto |
|------|-----------|
| [DOCS_CI_CD.md](DOCS_CI_CD.md) | CI monorepo e **followup-3.0** (`ci-be` / `ci-fe`), workflow **security** (`followup-3.0-security.yml`), checklist merge (link), secret E2E opzionali, deploy Render. |
| **[CI_AND_TEST_GATES.md](CI_AND_TEST_GATES.md)** | **Gate CI followup-3.0:** cosa è obbligatorio vs periodico (unit FE/BE, integrazione, E2E smoke, build). |
| [CI_PROCESS_SCALE.md](CI_PROCESS_SCALE.md) | Pentest periodico, load/SLO, scalabilità — processo oltre i test automatici. |
| [OBSERVABILITY_ALERTS_FOLLOWUP.md](OBSERVABILITY_ALERTS_FOLLOWUP.md) | Checklist alert/metriche minime post-deploy (Render, Mongo). |
| [GITHUB_AUTOMATION_MAIN.md](GITHUB_AUTOMATION_MAIN.md) | **Senza aprire la UI delle PR:** script `scripts/gh-promote-to-main.sh` (push → PR → merge automatico) oppure come alleggerire la protezione su `main`. |
| [SECURITY_RUNBOOK.md](SECURITY_RUNBOOK.md) | Policy segreti, audit dipendenze, threat model minimo, **pipeline modulare** (§8), **dashboard HTML** e **pentest vs DAST** (§9), **KPI enterprise e SBOM** (§10). |
| [PENTEST_EXECUTION.md](PENTEST_EXECUTION.md) | Playbook operativo per avviare e chiudere un penetration test reale (scope, prerequisiti, output, retest). |
| [PENTEST_VENDOR_HANDOFF.md](PENTEST_VENDOR_HANDOFF.md) | Template da inviare al fornitore pentest (scope, ROE, accessi, SLA, output). |
| [plans/2026-03-24-devsecops-enterprise-roadmap.md](plans/2026-03-24-devsecops-enterprise-roadmap.md) | Roadmap DevSecOps oltre la pipeline: **KPI**, threat model esteso, **OIDC/secrets**, **SBOM**, WAF/API, **matrice vendor ASPM**. |
| [github-oidc-deploy.example.yml](github-oidc-deploy.example.yml) | Snippet commentato: **OIDC** da GitHub Actions verso cloud (no chiavi long-lived). |
| [gitlab-security-pipeline.example.yml](gitlab-security-pipeline.example.yml) | Esempio commentato per replicare la pipeline security su **GitLab CI** (opzionale). |
| [STAGING_ENTITLEMENTS_SMOKE.md](STAGING_ENTITLEMENTS_SMOKE.md) | Checklist manuale post-deploy: console Tecma, 403 entitlement, liste workspace. |
| [API_RIUSABILI.md](API_RIUSABILI.md) | API per uso esterno (riusabili): listati appartamenti, lista light clienti; contratti, auth, esempi; riferimento OpenAPI. |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Logging strutturato (`pino`), request correlation (`x-request-id`/`x-correlation-id`), OpenTelemetry (traces + metriche OTLP). |
| [ACCEPTANCE_GATES.md](ACCEPTANCE_GATES.md) | Gate finali bloccanti: soglie CI hard, journey E2E core stabilizzati, verifica operativa post-release. |
| [LEGACY_RUNTIME_POLICY.md](LEGACY_RUNTIME_POLICY.md) | Policy di cutover Big Bang: rimozione fallback legacy runtime nei servizi core e guard CI anti-regressione. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Design system condiviso: pacchetto `@tecma/design-system-tokens`, configurazione in fe-followup-v3, variabili CSS e Tailwind. |
| [DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md) | Wave per l’import delle componenti Figma (Button, Input, ecc.); stato per componente. |
| [AUTH_AND_TECMA_BSS_API_REPORT.md](AUTH_AND_TECMA_BSS_API_REPORT.md) | Stato API TECMA-BSS (aws-api-gateway), auth esistente, cosa manca, test. |
| [fe-followup-v3/ARCHITECTURE.md](../fe-followup-v3/ARCHITECTURE.md) | Architettura frontend: struttura `src/`, come aggiungere una pagina o un endpoint, hook `usePaginatedList` e `useAsync`. |
| [REFACTORING.md](REFACTORING.md) | Refactoring strutturale (sprint): split project-config BE, route v1, IntegrationsPage (catalog/tab), pagine FE (costanti/hook/componenti), toast per errori API. |
| [CURSOR_MCP_TWILIO.md](CURSOR_MCP_TWILIO.md) | Twilio reale in Followup vs server MCP `@twilio-alpha/mcp` in Cursor: cosa fa ciascuno, esempio config (senza segreti in repo). |
| [plans/README.md](plans/README.md) | Punta al piano globale (cartella `plans/` senza altri file di piano). |

---

## Archivio (storico, non backlog)

Vedi **[archive/README.md](archive/README.md)** — nota su documenti storici rimossi; il piano attivo è solo **PIANO_GLOBALE_FOLLOWUP_3**.
