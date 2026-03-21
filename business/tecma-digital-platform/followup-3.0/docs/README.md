# Documentazione Followup 3.0

Indice della documentazione di progetto. **Piano unico (checklist, fasi, backlog):** [PIANO_GLOBALE_FOLLOWUP_3.md](PIANO_GLOBALE_FOLLOWUP_3.md). Visione e wave: [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md).

---

## Documenti maestro

| File | Contenuto |
|------|-----------|
| **[PIANO_GLOBALE_FOLLOWUP_3.md](PIANO_GLOBALE_FOLLOWUP_3.md)** | **Unico piano operativo:** checklist, fasi 0–8, workspace/segregazione, Millennium, AI aggregata, entitlement, dati legacy, roadmap implementativa. |
| **[FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md)** | North Star, principi, visione, cosa non fare, riferimento followup-nova, wave 1–7 in ordine vincolante, regole non negoziabili. |

---

## Documenti di supporto

| File | Contenuto |
|------|-----------|
| [DOCS_CI_CD.md](DOCS_CI_CD.md) | CI monorepo e **followup-3.0** (`ci-be` / `ci-fe`), checklist merge (link), secret E2E opzionali, deploy Render. |
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
