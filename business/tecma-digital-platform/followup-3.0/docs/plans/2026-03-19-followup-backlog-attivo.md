# Followup 3.0 — Backlog attivo (unico)

**Ultimo aggiornamento:** 2026-03-19  
**Uso:** unico punto per priorità eseguibili. Visione wave e principi: [FOLLOWUP_3_MASTER.md](../FOLLOWUP_3_MASTER.md). Dettaglio utenti workspace / segregazione: [PLAN_UNIFICATO_FOLLOWUP_3.md](../PLAN_UNIFICATO_FOLLOWUP_3.md). Millennium (UX): [fe-followup-v3/docs/plans/crm-millennium-piano-unificato.md](../../fe-followup-v3/docs/plans/crm-millennium-piano-unificato.md).

**Verifica repo 2026-03-19:** Wave 5 — `be-followup-v3/openapi/openapi.v1.yaml` espone tra l’altro `POST /apartments/query` e `POST /clients/lite/query`; endpoint `GET /v1/openapi.json` attivo. Wave 3 — crea/modifica cliente (drawer), “Nuovo evento” in calendario presenti in FE. CRM UX mar 2025 — `ViewModeToggle` usato in Progetti; liste Clienti/Appartamenti senza toggle card/tabella (residuo opzionale).

---

## Tabella priorità (max focus)

| # | Tema | Stato | Riferimento |
|---|------|-------|-------------|
| 1 | Workspace users + `tz_workspace_user_projects` + drawer “Aggiungi utente” | Da fare | [PLAN_UNIFICATO §4–7](../PLAN_UNIFICATO_FOLLOWUP_3.md) |
| 2 | Entity assignments + filtro liste non-admin | Da fare | Idem |
| 3 | Wave 7 — AI cockpit (aggregazione suggerimenti) | In corso / da completare | [aggregated-ai design+impl](./2026-03-19-aggregated-ai-suggestions-design.md) |
| 4 | API pubbliche — auth connettori (API key/OAuth oltre rate limit IP) | Gap | Millennium W4; OpenAPI già presente |
| 5 | Refactor / debito tecnico (API layer, pagine grandi) | Parziale | [code-simplifier plan](./2026-03-19-followup-code-simplifier-refactor.md) |
| 6 | UX mobile (fasi da design) | Backlog | [archive: mobile design](../archive/plans-2025-2026/2026-03-06-mobile-friendly-design.md) |
| 7 | Matching BE `/v1/matching/.../candidates` | Se richiesto | PLAN_UNIFICATO §6–7 |
| 8 | Dialog → Drawer (residui) | Se richiesto | PLAN_UNIFICATO §7 |
| 9 | Test / coverage / E2E / CI | Continuo | [archive PLAN_100_PERCENT](../archive/PLAN_100_PERCENT_FULL_APP.md) |
| 10 | UX liste — card/toggle su Clienti e Appartamenti | Opzionale | [archive crm-ux](../archive/plans-2025-2026/2025-03-06-crm-ux-interaction-design.md) |

---

## Stream A — Prodotto / dominio

- Implementare ordine da PLAN_UNIFICATO: `user.workspaces[]` (test-zanetti), route workspace users, `tz_workspace_user_projects`, estensione `getProjectAccessByEmail`, drawer FE.
- Poi `tz_entity_assignments` e filtro query clienti/appartamenti.

## Stream B — Millennium / integrazioni esterne

- OpenAPI per listing/query: **fatto** lato spec; tab Integrazioni già documenta endpoint.
- **Gap:** autenticazione dedicata per chiamate esterne (API key workspace o OAuth) dove oggi c’è solo JWT utente e/o rate limit IP su route pubbliche — allineare prodotto + doc.

## Stream C — Wave 7 / AI

- Completare piano aggregazione suggerimenti cockpit (design + implementation plan in `docs/plans/`).
- Poi: approvazioni per azioni draft (come da MASTER W7).

## Stream D — Qualità / piattaforma

- Initiative tratte da [roadmap 9/10 in archive](../archive/plans-2025-2026/2026-03-18-roadmap-9-10.md): CI/CD `.github/workflows`, coverage gate, riduzione file hub — **una milestone alla volta**, non riaprire l’intero documento come backlog giornaliero.

## Stream E — Mobile

- Seguire fasi in `2026-03-06-mobile-friendly-design.md` (archiviato): checklist per pagina, poi implementazione incrementale.

## Stream F — Refactor

- Eseguire per fasi [followup-code-simplifier-refactor.md](./2026-03-19-followup-code-simplifier-refactor.md) senza mescolare con feature nelle stesse PR dove possibile.

---

## Strategia CRM generica (non backlog giornaliero)

Linee guida e runbook archiviati in [archive/plans-2025-2026/](../archive/plans-2025-2026/) (`2026-03-19-crm-avanzato-*.md`).

## Email operative vs marketing

Design archiviato: [2026-03-19-email-operativo-vs-connettori-design.md](../archive/plans-2025-2026/2026-03-19-email-operativo-vs-connettori-design.md) — confine transazionale in-app vs connettore; mappa eventi MoSCoW.
