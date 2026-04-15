# Followup 3.0 — tracker implementativo (repo)

**Uso:** checklist unica nel monorepo; sostituisce riferimenti a tool esterni per sapere *cosa è fatto nel codice* e *cosa resta*.  
**Roadmap su più cicli (ordine e DoD):** [MULTI_CYCLE_ROADMAP.md](./MULTI_CYCLE_ROADMAP.md).  
**Allineamento:** ID tema = [PIANO_GLOBALE_FOLLOWUP_3.md](../docs/PIANO_GLOBALE_FOLLOWUP_3.md) §2.  
**Tag:** **A** = piano/FASE · **B** = parità legacy (perimetro) · **C** = valore rapido (vedi [priorità A/B/C](../docs/plans/2026-04-08-priorita-abc-followup-design.md)).

Legenda stato: `[x]` fatto (baseline o verificato in repo) · `[ ]` da fare o incompleto · `[~]` in corso / parziale

---

## Checklist globale (tabella piano)

| Stato | ID | Tag | Tema | Note / area codice |
|-------|-----|-----|------|---------------------|
| [x] | `close-phase0` | A,C | Workspace, `tz_workspace_user_projects`, entity assignments, cockpit aggregato, platform clients lite, matching routes | `be-followup-v3` routes + `fe-followup-v3` |
| [x] | `user-access-granularity` | A,B | RBAC granulare, wizard utenti, permission catalog, audit membership | `permissions.ts`, Utenti UI |
| [x] | `commercial-entitlements` | A,B,C | Entitlement vs RBAC; Public API / Twilio / Mailchimp/AC gated | BE + FE; ciclo 1 (2026-04-08): link `VITE_TECMA_COMMERCIAL_*` in tab API + drawer Twilio/MC/AC; audit `notesChanged` su PATCH entitlement. Gate nuove integrazioni a pagamento: vedi matrice in docs. |
| [x] | `connectors-showcase-ux` | A,C | Vetrina connettori per utenti senza modulo | Incluso in integrazioni |
| [x] | `tecma-activation-audit` | A | Console Tecma + audit attivazioni | `TecmaEntitlementsPage` + `workspace.entitlement.updated` (payload con `notesChanged`); audit lettura liste via GET esistente |
| [~] | `csv-mapping` | A,B | CSV legacy → `tz_*` | **Quote (chiuso perimetro ciclo 3):** FASE1 tabella + dual-mode + `extractLegacyQuoteTotalPrice` in migrazione; `POST /v1/quotes/query`. Restano: export CSV espliciti e matrici cliente/app oltre volumetria Mongo già in doc. [FASE1](../docs/deliverables/FASE1_CSV_MAPPING.md) |
| [x] | `s3-verify` | A,B | Presigned S3 + verifica operativa | [FASE3_S3_VERIFICATION](../docs/deliverables/FASE3_S3_VERIFICATION.md) — servizio già in `assets-s3.service`; **2026-04-08:** `GET /tecma/storage/assets-diagnostics` + UI Tecma entitlements; checklist manuale IAM/upload su staging resta in FASE3 |
| [~] | `digital-quote` | A,B | Quote, PDF, magic link | **Repo:** ok — [FASE2 stato + test BE](../docs/deliverables/FASE2_DIGITAL_QUOTE.md). **Per chiudere `[x]`:** eseguire [Checklist QA staging](../docs/deliverables/FASE2_DIGITAL_QUOTE.md#checklist-qa-staging) e spuntare DoD in FASE2. |
| [~] | `reports-dashboards` | A,C | Report avanzati, dashboard condivisibili | **2026-04-14:** `tz_report_definitions` + CRUD `/v1/report-definitions` + sezione «Preferiti salvati» su pagina Report (`fe-followup-v3`). **2026-04-02:** audit letture link snapshot pubblico (`security.report_snapshot.accessed` → `tz_security_audit`). **Condivisione da preferito:** `POST /v1/reports/share-definition` + UI «Link pubblico» (snapshot deterministico, `snapshotKind: definition`). Dettaglio: [FASE4](../docs/deliverables/FASE4_REPORTS_DASHBOARDS.md). Restano: AI opt-in centralizzato se serve; eventuale indicazione `snapshotKind` in lista link condivisi in UI. |
| [~] | `calendar-sync` | A,B | Gmail/Outlook reali oltre UI calendario | **[~] 2026-04-14:** BE `outlook.service` + OAuth + `GET /connectors/outlook/status|calendar/events`; FE `CalendarPage`: banner se non collegato, merge eventi Graph in griglia (`source: OUTLOOK`), drawer sola lettura + link web. **Restano:** Gmail/sync incrementale/job, refresh token lifecycle oltre flusso attuale, unificazione scrittura eventi da tutte le UI se ancora frammentata. [FASE5](../docs/deliverables/FASE5_CALENDAR_SYNC.md) |
| [ ] | `connectors-ux` | A,C | Twilio dedicato, dummy RE, MCP opzionale | [FASE6](../docs/deliverables/FASE6_CONNECTORS_UX.md) |
| [ ] | `inbox-contract` | A,C | Contratto inbox, preferenze | [FASE7](../docs/deliverables/FASE7_INBOX_CONTRACT.md) |
| [ ] | `visual-parity` | A,B | Parità UI vs ITD | [FASE8](../docs/deliverables/FASE8_VISUAL_PARITY.md) |
| [ ] | `ux-mobile` | A,C | Checklist mobile per pagina | |
| [ ] | `refactor-api-layer` | A,C | Facade `followupApi` / domini FE | `fe-followup-v3/src/api/` |
| [x] | `matching-be` | A,C | Endpoint matching candidates | `matching.routes.ts`, UI matching |
| [ ] | `dialog-drawer` | C | Dialog → Drawer residui | Varie pagine |
| [ ] | `ux-liste-card-toggle` | C | Card/toggle liste Clienti/Appartamenti | |

---

## Come aggiornare questo file

1. Chiudi una riga solo quando il criterio è **verificabile** (test, deploy, o checklist deliverable compilata).
2. Aggiungi una sotto-sezione “Dettaglio” sotto un ID solo se serve elenco file/PR.
3. Non cancellare righe: usa `[x]` / `[~]` / `[ ]` per storia leggibile.

---

*Creato per tracciare l’implementazione nel repo Followup 3.0 senza dipendere da sistemi esterni.*
