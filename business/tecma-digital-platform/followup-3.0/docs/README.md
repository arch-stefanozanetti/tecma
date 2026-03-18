# Documentazione Followup 3.0

Indice della documentazione di progetto. **Punto di partenza:** [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md).

---

## Documento maestro (prodotto e piano)

| File | Contenuto |
|------|-----------|
| **[FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md)** | **Piano di riferimento unico:** North Star, principi, visione, cosa non fare, riferimento followup-nova, wave 1–7 in ordine vincolante, regole non negoziabili, riferimenti. Aggiornare quando si chiude una wave o si aggiunge un task. |

---

## Documenti di supporto

| File | Contenuto |
|------|-----------|
| [API_RIUSABILI.md](API_RIUSABILI.md) | API per uso esterno (riusabili): listati appartamenti, lista light clienti; contratti, auth, esempi; riferimento OpenAPI. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Design system condiviso: pacchetto `@tecma/design-system-tokens`, configurazione in fe-followup-v3, variabili CSS e Tailwind. |
| [DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md) | Wave per l’import delle componenti Figma (Button, Input, ecc.); stato per componente. |
| [AUTH_AND_TECMA_BSS_API_REPORT.md](AUTH_AND_TECMA_BSS_API_REPORT.md) | Stato API TECMA-BSS (aws-api-gateway), auth esistente, cosa manca, test. |
| [fe-followup-v3/ARCHITECTURE.md](../fe-followup-v3/ARCHITECTURE.md) | Architettura frontend: struttura `src/`, come aggiungere una pagina o un endpoint, hook `usePaginatedList` e `useAsync`. |
| [REFACTORING.md](REFACTORING.md) | Refactoring strutturale (sprint): split project-config BE, route v1, IntegrationsPage (catalog/tab), pagine FE (costanti/hook/componenti), toast per errori API. |
| [plans/2025-03-07-unificazione-api-aws-gateway-followup.md](plans/2025-03-07-unificazione-api-aws-gateway-followup.md) | Piano task-by-task per unificare le API Followup con aws-api-gateway (merge spec, test, Postman, FE). |

---

## File deprecati (solo riferimento storico)

I contenuti rilevanti sono stati unificati in **FOLLOWUP_3_MASTER.md**. Non usare come fonte di verità.

- `FOLLOWUP_3_EVOLUTION_PLAN.md` — sostituito da FOLLOWUP_3_MASTER.md (sezione 4 e 5).
- `FOLLOWUP_3_MEGA_CRM_MASTERPLAN.md` — visione sintetizzata in FOLLOWUP_3_MASTER.md (sezione 2).
- `FOLLOWUP_FUTURE_AI_NATIVE_PLAN.md` — direzione AI/evoluzioni in FOLLOWUP_3_MASTER.md (Wave 7 e sezione 2).
