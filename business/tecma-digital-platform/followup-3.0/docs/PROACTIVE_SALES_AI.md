# Proactive Sales AI — Architettura e prodotto (FollowUp 3.0)

Documento di **progettazione** per un agente AI **proattivo**: a differenza dell’assistente reattivo (es. ZEUS / risposte inbound), questo sistema decide **quando** e **perché** contattare un lead, con obiettivo **conversione lead → visita → vendita**.

Allineamento con il codice esistente:

- Multi-tenant per `workspaceId` (come il resto del CRM).
- Possibile riuso del pattern **suggerimenti** già presente (`generateAiSuggestions`, `tz_ai_suggestions`, orchestrator in [`orchestrator.service.ts`](../be-followup-v3/src/core/ai/orchestrator.service.ts)).
- Estensione naturale delle **automazioni** (`tz_automation_rules`, eventi `visit.*`, `request.*`) per trigger event-driven.
- Canali email/WhatsApp già modellati nelle **communication rules** (template + canale).

---

## 1. Obiettivo e principi

| Principio | Implicazione |
|-----------|----------------|
| Nessun “spam” | Ogni contatto ha **trigger verificabile**, **motivo** e **contesto CRM reale**. |
| Proattività controllata | **Decision engine** prima del messaggio; **frequency cap** e **dedup** obbligatori. |
| Sicurezza commerciale | No urgenza finta, no disponibilità inventata; **escalation** se incertezza alta. |
| Human-in-the-loop | Default **suggestion mode**; **auto mode** solo per trigger a basso rischio e con policy workspace. |

---

## 2. Algoritmo decisionale (scoring semplice, versione 1)

Per ogni coppia **(lead, contesto)** il motore produce uno score e una decisione strutturata.

### 2.1 Segnali numerici (normalizzati 0–1)

Esempi (pesi configurabili per workspace):

| Segnale | Fonte dati | Note |
|---------|------------|------|
| `silence_days` | `tz_clients.updatedAt`, ultimo messaggio/email noto | Alto se > soglia trigger “lead silenzioso”. |
| `match_new_listing` | `tz_apartments` + associazioni / preferenze lead | Compatibilità budget/zona/tipologia. |
| `scarcity` | richieste su unità, stato opzionato/vendita imminente | Da `requests`, `tz_apartments.status`, metriche se disponibili. |
| `post_visit` | eventi `visit.completed` (automazioni esistenti) | Finestra temporale dopo visita. |
| `price_change` | storico prezzi / `updatedAt` su unità collegate | Solo se delta reale in DB. |
| `engagement` | conteggi interazioni recenti (email, WA, richieste) | “Lead caldo”. |

### 2.2 Score aggregato

```
score = Σ (weight_i * signal_i) - penalty_spam - penalty_recent_contact
```

- `penalty_spam`: messaggi già inviati nella finestra (vedi §5).
- `penalty_recent_contact`: ultimo outreach Proactive troppo recente.

### 2.3 Decisione strutturata (output del motore)

Allineato alla richiesta prodotto:

```json
{
  "should_contact": true,
  "priority": "high",
  "reason": "string",
  "best_channel": "email",
  "timing": "immediate"
}
```

**Regole minime:**

- `should_contact = false` se: nessun trigger attivo, score sotto soglia, frequency cap violato, o dati insufficienti per messaggio contestuale.
- `priority`: `high` se trigger urgenza reale + score alto; `medium`/`low` altrimenti.
- `best_channel`: da preferenze lead + connettori abilitati (email/WhatsApp); default policy workspace.
- `timing`: `immediate` solo se trigger time-sensitive (es. prezzo/appena disponibile); altrimenti `wait` + slot in coda (es. batch notturno).

Il JSON può essere prodotto da **regole deterministiche** (v1) e opzionalmente **validato/raffinato** da LLM con schema rigido (v2), mai l’inverso (LLM che inventa trigger).

---

## 3. Schema dati (trigger e opportunità)

### 3.1 Tipi di trigger (enum estendibile)

| `triggerType` | Descrizione |
|---------------|-------------|
| `lead_silent` | Nessun contatto/risposta da ≥ X giorni (X configurabile). |
| `new_availability` | Unità compatibile appena disponibile / rientrata. |
| `scarcity` | Molte richieste / stato quasi venduto (solo se verificabile in CRM). |
| `post_visit` | Dopo `visit.completed` senza follow-up registrato. |
| `price_change` | Variazione prezzo su unità di interesse (solo con storico o campo verità). |
| `hot_lead` | Picco interazioni recenti sopra soglia. |

### 3.2 Collection proposta: `tz_proactive_opportunities`

Record = **opportunità di contatto** (non necessariamente inviata).

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `workspaceId` | string | Tenant |
| `projectId` | string | Progetto |
| `clientId` | string | Lead/cliente |
| `triggerType` | enum | Tipo sopra |
| `triggerPayload` | object | Id unità, delta prezzo, date, riferimenti verificabili |
| `decision` | object | `should_contact`, `priority`, `reason`, `best_channel`, `timing` |
| `suggestedMessage` | object | `{ subject?, body, locale }` (bozza) |
| `status` | enum | `pending_review` \| `approved` \| `sent` \| `dismissed` \| `expired` |
| `mode` | enum | `suggestion` \| `auto` |
| `dedupeKey` | string | Hash(workspaceId, clientId, triggerType, triggerPayload stable) |
| `createdAt`, `updatedAt` | ISO date | Audit |
| `sentAt` | ISO date? | Se inviato |
| `createdBy` | `system` \| userId | |

**Indici:** `(workspaceId, status, updatedAt)`, `(workspaceId, clientId, createdAt)`, **unique** `(workspaceId, dedupeKey)` per evitare duplicati.

### 3.3 Collection proposta: `tz_proactive_outreach_log`

Tracciamento invii per **frequency cap** e KPI.

| Campo | Descrizione |
|-------|-------------|
| `workspaceId`, `clientId`, `channel`, `sentAt`, `opportunityId`, `triggerType` |

Indice: `(workspaceId, clientId, sentAt)` per query “quanti messaggi nell’ultima settimana”.

### 3.4 Config workspace: `tz_proactive_sales_config` (o JSON in `tz_workspaces`)

- Soglie giorni “silenzioso”, pesi score, **max 2 messaggi/settimana/lead** (default richiesto).
- Elenco trigger abilitati.
- Modalità globale: `suggestion` | `auto` (con whitelist trigger per auto).
- Orari invio (no notte, fuso orario).

---

## 4. Flusso end-to-end

### 4.1 Modalità A — Batch (cron / worker)

Adatto a v1 e a Render/worker già presente (`job-runner`).

1. Job schedulato (es. ogni 15–60 min) per workspace.
2. Carica lead candidati (query paginata su `tz_clients` + join richieste/associazioni).
3. Per ogni lead, calcola segnali e score (§2).
4. Se `should_contact` e non violato frequency cap → crea/aggiorna `tz_proactive_opportunities` con `status = pending_review` (suggestion) o enqueue invio (auto).
5. Se suggestion: notifica vendor / compare in UI “AI Opportunities”.
6. Se auto: invio tramite canali esistenti (email/WhatsApp) + scrittura `tz_proactive_outreach_log` + attività CRM.

### 4.2 Modalità B — Event-driven

Estendere `AUTOMATION_EVENT_TYPES` (o consumare gli stessi eventi dal `event-log`) per:

- `apartment.price_changed`, `apartment.status_changed`, `visit.completed`, ecc.

Il worker reagisce con latenza bassa solo per trigger ad alta priorità; il resto resta in batch per costi.

### 4.3 Integrazione messaggio

- **Suggestion mode:** UI mostra testo → utente **Invia / Modifica / Ignora** → chiamata API che invia e aggiorna stato.
- **Auto mode:** solo se `triggerType ∈ whitelist` e `decision.priority` ≥ soglia e confidence dati ≥ soglia.

---

## 5. Frequency control (anti-spam)

| Regola | Implementazione |
|--------|-----------------|
| Max 2 messaggi/settimana per lead | Query su `tz_proactive_outreach_log` rolling 7 giorni. |
| No duplicati | `dedupeKey` unique; rigenerazione solo se trigger cambia (nuovo prezzo / nuova unità). |
| No messaggi “vuoti” | Gate: lunghezza minima contesto (es. almeno un `apartmentId` o preferenza collegata); altrimenti `should_contact=false`. |
| Cool-off globale | Dopo “Ignora”, non riproporre stesso `dedupeKey` per N giorni. |

---

## 6. Human in the loop

| Modalità | Comportamento |
|----------|----------------|
| **Suggestion (default)** | Opportunità in `pending_review`; nessun invio fino ad azione umana. |
| **Auto** | Invio automatico solo per trigger definiti “sicuri” (es. post-visita gentile, disponibilità verificata) + policy workspace. |

Escalation: se `decision` ha incertezza (es. segnali conflittuali) → `should_contact=false` o creazione task per agente senza messaggio al cliente.

---

## 7. CRM actions post-invio

- **Log attività:** timeline cliente (tipo `proactive_ai_outreach`) con `triggerType`, snippet messaggio, link opportunità.
- **Stato lead:** aggiornamento controllato (es. tag “contattato da AI”) senza sovrascrivere stato trattativa sensibile senza regole.
- **Notifica agente:** in-app (già pattern `create_notification`) + opzionale email interna.

---

## 8. Prompt LLM — generazione messaggio (solo dopo decisione)

Il modello **non** decide il trigger; riceve **solo** fatti strutturati dal CRM.

**System (esempio):**

```
Sei un assistente commerciale per il CRM immobiliare FollowUp.
Genera un messaggio breve (max 4-5 righe) in italiano, tono umano e non aggressivo.
Usa SOLO i dati nel blocco FACTS. Non inventare disponibilità, prezzi o urgenze.
Se non puoi essere specifico, rispondi che serve un consulente (non inviare questo testo al cliente in quel caso — il chiamante deve scartare).
Output JSON: { "subject": string|null, "body": string }
```

**User:**

```
FACTS (JSON):
{ ... dati veri: nomi, codice unità, prezzo solo se presente, stato, motivo del trigger ... }
CHANNEL: email | whatsapp
```

Validazione: Zod su output; rifiuto se `body` contiene placeholder o se manca riferimento ad almeno un fatto in FACTS (euristica + opzionale second pass LLM “self-check” disabilitato in v1).

---

## 9. UI — “AI Opportunities”

### 9.1 Lista

Colonne suggerite:

- Lead (nome + progetto)
- **Motivo** (trigger + `reason` sintetico)
- **Priorità** (badge high/medium/low)
- **Anteprima messaggio**
- Stato (`pending_review`, …)
- Data creazione

Filtri: priorità, trigger, progetto, stato.

### 9.2 Azioni per riga

- **Invia** — conferma invio sul canale proposto (o scelta canale se entrambi abilitati).
- **Modifica** — editor testo + oggetto email; poi invia.
- **Ignora** — `status = dismissed` + cool-off (opzionale).

### 9.3 Flusso UX

1. Notifica o badge nel menu principale quando ci sono `pending_review`.
2. Dettaglio lead in sidebar con storico opportunità e log invii.
3. Impostazioni workspace: soglie, modalità suggestion/auto, whitelist trigger.

---

## 10. KPI tracking

Metriche minime (dashboard o export):

| KPI | Definizione |
|-----|-------------|
| Tasso risposta lead | Risposte entro 7gg dopo outreach / invii |
| Visite prenotate | Eventi `visit.scheduled` attribuiti a opportunità (id in metadata) |
| Lead persi | Passaggio a stato chiuso perso senza outreach precedente (benchmark) |
| Volume invii | Per trigger / canale / settimana |
| Tasso ignorati | `dismissed` / create |

Storage: aggregati su `tz_proactive_outreach_log` + join requests/visits; opzionale BigQuery se già usato dal progetto.

---

## 11. Success metrics (allineamento business)

- Aumento **risposta clienti** (tasso di risposta post-messaggio).
- Aumento **visite prenotate** da lead in target.
- Riduzione **lead persi** per silenzio (confronto cohort prima/dopo).

---

## 12. Vincoli non funzionali

- **Scalabile:** job batch paginato; niente scan full collection senza limiti; idempotenza su `dedupeKey`.
- **Multi-tenant:** tutte le query e indici con `workspaceId`.
- **Configurabile:** soglie e trigger per workspace (e in futuro per progetto).

---

## 13. Roadmap tecnica suggerita

| Fase | Contenuto |
|------|-----------|
| **P0** | Schema Mongo + decision engine deterministico + 1–2 trigger (lead silenzioso, post-visita) + UI lista suggestion-only |
| **P1** | Frequency cap + dedup + più trigger + prompt messaggio con validazione |
| **P2** | Event-driven + auto mode whitelist + KPI dashboard |
| **P3** | Affinamento LLM sul solo copy + A/B test messaggi |

---

## 14. Riferimenti nel repo

- Suggerimenti AI esistenti: [`orchestrator.service.ts`](../be-followup-v3/src/core/ai/orchestrator.service.ts), `tz_ai_suggestions`.
- Automazioni: [`automation-rules.service.ts`](../be-followup-v3/src/core/automations/automation-rules.service.ts).
- Comunicazioni: [`communication-rules.service.ts`](../be-followup-v3/src/core/communications/communication-rules.service.ts).

Questo documento è il punto di partenza per issue di implementazione (BE worker, API, FE, OpenAPI) senza duplicare qui interi contratti REST.
