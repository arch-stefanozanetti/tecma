# Product Discovery in FollowUp — Design

Sistema leggero per raccogliere feedback clienti e trasformarli in decisioni di prodotto. Visibile **solo agli utenti admin**. Integrato in FollowUp 3.0 con persistenza su MongoDB (stesso DB, es. test-zanetti).

Riferimento dettagliato campi ed esempi: `product-discovery-system.md` (se presente in repo).

---

## Obiettivo

- Raccolta segnali dal campo (feedback cliente)
- Identificazione problemi ricorrenti (opportunities)
- Collegamento alla roadmap (initiatives → features)
- Evitare backlog caotici guidati da singoli clienti

Flusso: **Customer Need → Opportunity → Initiative → Feature**.

---

## Principi UX

- Inserimento feedback **< 30 secondi** (form minimal, max 6 campi obbligatori).
- Un solo punto di ingresso: pulsante «+ Nuovo feedback cliente».
- Navigazione per problemi (Opportunities), non per ticket.
- Ogni Opportunity mostra il **numero di feedback collegati** per dare peso alle decisioni.

---

## Architettura interfaccia

Una sezione **Product Discovery** (solo admin) con 6 sotto-viste (tab):

1. **Customer Needs** — Tabella feedback con **Score** (severity×frequenza×impact); pulsante «+ Nuovo feedback cliente»; click riga → dettaglio.
2. **Opportunities** — Tabella problemi ricorrenti con conteggio feedback; click → dettaglio e lista need collegati.
3. **Initiatives** — Tabella roadmap con **ROI Score** (impact/effort), Effort, Impact; click → dettaglio e modifica Effort/Impact.
4. **Feature backlog** — Tabella feature con initiative; click → dettaglio.
5. **Suggested Roadmap** — Top 5 initiative per ROI (automatico).
6. **Top Problems** — Top 5 opportunity per numero di feedback (automatico).

Form inserimento feedback: Problema, Cliente, Segmento, Severity, Frequenza, Business impact, Fonte; Workaround opzionale. Target 15–20 s.

---

## Database (MongoDB, stesso DB FollowUp)

Quattro collection con prefisso `tz_`:

- **tz_customer_needs** — title, problem, customer_name, customer_segment, severity, source, workaround, status, opportunity_id, created_by, createdAt, updatedAt.
- **tz_opportunities** — title, problem_statement, affected_users, feedback_count (denormalizzato), impact_score, initiative_id, createdAt, updatedAt.
- **tz_initiatives** — title, description, product_area, priority, status, opportunity_ids, createdAt, updatedAt.
- **tz_features** — title, description, initiative_id, status, createdAt, updatedAt.

Relazioni: customer_need.opportunity_id → opportunities; opportunity.initiative_id → initiatives; feature.initiative_id → initiatives.

Indici: vedi `docs/MAIN_DB_SCHEMA.md` sezione Product Discovery.

---

## API (backend FollowUp, requireAdmin)

- **Customer Needs**: GET/POST `/v1/customer-needs`, GET/PATCH `/v1/customer-needs/:id`. Query: opportunityId, status. Response include `score` (calcolato).
- **Opportunities**: GET/POST `/v1/opportunities`, GET/PATCH `/v1/opportunities/:id`. Query: initiativeId.
- **Initiatives**: GET/POST `/v1/initiatives`, GET/PATCH `/v1/initiatives/:id`. Campi `estimated_dev_effort`, `estimated_business_impact`; response include `roi_score` (impact/effort).
- **Features**: GET/POST `/v1/features`, GET/PATCH `/v1/features/:id`. Query: initiativeId.
- **Suggested Roadmap**: GET `/v1/product-discovery/suggested-roadmap` — top 5 initiative per ROI.
- **Top Problems**: GET `/v1/product-discovery/top-problems` — top 5 opportunity per feedback_count.

Tutte le route sono protette con `requireAuth` + `requireAdmin`.

### Algoritmi (allineati a Excel demo)

- **Score need**: `severityWeight × frequencyWeight × impactWeight` (pesi da Lists: es. Blocking=3, High friction=2, Minor=1; 1 customer=1, 2-3=2, 4+=3; Deal blocker=3, Upsell=2, Efficiency=2).
- **ROI initiative**: `estimated_business_impact / estimated_dev_effort` (solo se entrambi impostati).
- **Suggested Roadmap**: prime 5 initiative ordinate per `roi_score` decrescente.
- **Top Problems**: prime 5 opportunity ordinate per `feedback_count` decrescente.

---

## Flusso operativo

1. Sales/CS inseriscono feedback → customer_need, status = collected.
2. Product raggruppa feedback → crea/aggiorna opportunity, assegna opportunity_id ai need (feedback_count aggiornato dal backend).
3. Product crea initiative e collega opportunities.
4. Engineering crea feature collegate a un’initiative.

---

## Implementazione

- **Backend**: `be-followup-v3/src/core/product-discovery/` (customer-needs, opportunities, initiatives, features services); route in `routes/v1.ts` con requireAdmin.
- **Frontend**: sezione `productDiscovery` in nav (adminOnly, group admin); `ProductDiscoveryPage` con 4 tab, tabelle, form «Nuovo feedback», sheet di dettaglio; API in `followupApi`.
- **Documentazione**: `docs/MAIN_DB_SCHEMA.md` aggiornato con le 4 collection; `unifyMainDb.ts` include le nuove collection per copia unificata DB.
