# Design: capacità CRM avanzate (con e senza AI)

**Data:** 2026-03-19  
**Riferimento:** catalogo “Funzionalità avanzate per un CRM” (brainstorming piano CRM).  
**Scopo:** chiudere tre decisioni operative — vertical primario, fondamenta tecniche/prodotto, primi use case AI misurabili — senza diluire lo scope.

---

## 1. Utente primario e taglio del catalogo

### Decisione

| Voce | Scelta |
|------|--------|
| **Primario** | **Vendite B2B** (pipeline, account, opportunità, attività, forecast di squadra) |
| **Secondario fase 1** | **RevOps / Marketing ops** (attribuzione leggera, campi UTM, handoff lead→opportunità, reporting funnel) |
| **Secondario fase 2** | **Customer Success** (health score manuale o semi-automatico, renewal pipeline, ticket legati all’account) |
| **Non prioritario iniziale** | Suite “full” parity con HubSpot/Salesforce (PRM, CPQ pesante, data warehouse nativo) |

**Motivazione:** il percorso **B — Revenue platform** (vedi piano CRM) richiede un nucleo vendite forte; RevOps abilita misurazione senza duplicare un MAP completo; CS entra quando il dato account/opportunità è stabile.

### Mappa catalogo → fase (dopo il taglio)

Legenda: **P0** = prima ondata con utente primario; **P1** = subito dopo; **P2** = roadmap successiva; **—** = fuori scope iniziale o solo integrazione esterna.

| Area | Capacità (dal catalogo) | Fase |
|------|-------------------------|------|
| Dati | Oggetti/campi custom, validazioni, viste per ruolo | P0 |
| Dati | Golden record, merge, duplicati | P0 |
| Dati | Multi-entity (opp., contratti, progetti…) | P1 (estensione per dominio) |
| Dati | Territori, team selling, multi-valuta | P1 |
| Automazione | Workflow, approvazioni, SLA/escalation | P0 |
| Automazione | Playbook guidati | P1 |
| Automazione | Webhooks, event verso DWH | P1 |
| Integrazioni | Email/calendar, telefonia, e-sign | P0 (per tracciamento reale) |
| Integrazioni | ERP/fatturazione, MAP bidirezionale | P1 (solo connettori prioritari) |
| Integrazioni | SSO/IdP, SCIM | P0 per enterprise |
| Analytics | Pipeline, forecast, attribuzione base | P0 |
| Analytics | Cohort cross-funzione | P1 |
| Sicurezza | RBAC, condivisione record, audit campo | P0 |
| Sicurezza | Mascheramento, retention GDPR | P1 |
| Sicurezza | Sandbox config | P2 |
| Collaboration | Commenti, feed, documenti su record | P0 |
| Collaboration | Deal room | P2 |

---

## 2. Fondamenta allineate (P0)

Checklist di allineamento prima di feature “avanzate” visibili agli utenti finali.

### Modello dati

- [ ] Entità core versionate o con `updatedAt` coerente per sync verso integrazioni.
- [ ] Relazioni esplicite account ↔ contatti ↔ opportunità ↔ attività; vincoli di integrità lato API.
- [ ] Campi custom con tipo, obbligatorietà, e policy di indicizzazione per liste/report.
- [ ] Identità: strategia **una persona / un contatto** con possibile collegamento multi-account.

### RBAC e condivisione

- [ ] Ruoli con permessi CRUD per entità; permessi speciali (export, merge, admin campi).
- [ ] Condivisione record (owner, team, regole di visibilità territorio).
- [ ] Separazione **admin tenant** vs **utente operativo**.

### Audit e conformità

- [ ] Audit log append-only: chi, cosa, quando, record; per campi sensibili anche **before/after** (o hash).
- [ ] Export dati soggetto e cancellazione/anonymize dove richiesto da policy.
- [ ] Retention log configurabile (anche “mai” per legal hold — da definire con legale).

### Integrazioni must-have (P0)

| Integrazione | Obiettivo minimo |
|--------------|------------------|
| Email (invio + tracciamento legato al record) | Storia commerciale verificabile |
| Calendario (lettura slot / eventi collegati) | Attività e meeting sul CRM |
| SSO | Onboarding enterprise |
| Webhook o coda eventi | Estensibilità senza fork |

Telefonia ed e-sign: **P0** se il canale è voice-heavy o contratti digitali; altrimenti **P1**.

---

## 3. Use case AI misurabili (prima ondata)

Due use case con **ROI misurabile**, bassa superficie di allucinazione, dipendenza moderata dalla qualità dati strutturati.

### UC-AI-1 — Riassunto attività sul record (email + note + ultimi eventi)

| Aspetto | Dettaglio |
|---------|-----------|
| **Cosa fa** | Genera un riassunto breve (bullet) sul record account/opportunità, con fonti citate (ID messaggio/nota). |
| **Chi** | AE, manager, CS in lettura. |
| **KPI** | Tempo medio per “mettersi in pari” su un account (**target:** −30% vs baseline manuale); **tasso di accettazione** del riassunto (thumbs up/down > 70% positivi dopo 4 settimane). |
| **Guardrail** | Nessuna scrittura automatica su campi business-critical; solo bozza o pannello “suggerimento”. |
| **Dipendenze** | Testo indicizzato per record, permessi ereditati dal record. |

### UC-AI-2 — Estrazione strutturata con conferma (task / prossimo passo / data)

| Aspetto | Dettaglio |
|---------|-----------|
| **Cosa fa** | Da corpo email o nota vocale trascritta propone: titolo task, scadenza, collegamento opportunità; l’utente conferma in un click. |
| **Chi** | AE, SDR. |
| **KPI** | **Conversione** note/email → task creati (**target:** +15% task con scadenza vs periodo pre-AI); **tempo** da lettura a task salvato (**target:** −25%). |
| **Guardrail** | Conferma obbligatoria; nessun invio email automatico senza review. |
| **Dipendenze** | Parser timezone/locale; audit su “creato da suggerimento AI”. |

### Fuori dalla prima ondata (ma in backlog valutato)

- Lead scoring ML (richiede volume storico e label di conversione).
- NL → report (rischio permessi/schema; serve motore query governato).

---

## 4. Criteri di uscita (definizione di “fatto” per questo design)

- Vertical e fasi P0/P1/P2 concordati con product (questo doc è la proposta di default).
- Checklist sezione 2 usata come gate prima di rilasciare moduli “enterprise” (export massivo, merge, integrazioni billing).
- UC-AI-1 e UC-AI-2 hanno eventi di telemetria nominati e dashboard o query per i KPI sopra.

---

## 5. Prossimi passi operativi

1. Tradurre P0 in epiche/ticket con owner (backend, frontend, integrazioni).
2. Definire eventi analytics (`ai.summary.shown`, `ai.summary.feedback`, `ai.task_suggestion.accepted`, ecc.).
3. Allineamento legale/DPO su retention log e testo usato per training (se applicabile).
