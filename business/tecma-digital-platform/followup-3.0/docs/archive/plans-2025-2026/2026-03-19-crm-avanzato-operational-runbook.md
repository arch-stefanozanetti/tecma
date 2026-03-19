# Runbook esecuzione — Piano operativo CRM avanzato (Followup 3.0)

**Data:** 2026-03-19  
**Riferimenti:** [2026-03-19-crm-avanzato-capabilities-design.md](2026-03-19-crm-avanzato-capabilities-design.md) · piano operativo Cursor (non modificare il file in `.cursor/plans/`).

Questo documento **implementa** il piano operativo: decisioni kickoff, gate staging, UAT, ondate P1 e pilot AI con telemetria. Aggiornare stato e date al completamento reale delle attività.

---

## Fase 0 — Allineamento e kickoff

### 0.1 Decisione integrazioni canale (telefonia / e-sign)

Dal design: telefonia ed e-sign sono **P0** solo se il canale è voice-heavy o i contratti sono digitali; altrimenti **P1**.

| Domanda | Sì / No | Effetto |
|---------|---------|---------|
| >40% degli accordi passa da chiamate con logging obbligatorio? | | Se sì → **Telefonia P0** |
| Firma digitale è requisito legale/commerciale per chiudere entro il trimestre? | | Se sì → **E-sign P0** |

**Decisione registrata (compilare in kickoff):**

| Voce | Scelta (P0 / P1) | Motivo | Firmato (ruolo) | Data |
|------|------------------|--------|-----------------|------|
| Telefonia | | | | |
| E-sign | | | | |

**Default se il kickoff non decide:** entrambe **P1** per ridurre superficie integrativa nella Fase 1.

### 0.2 Epiche P0 per workstream (backlog seed)

Ogni epic include: owner funzionale, owner tecnico (WS), dipendenze, Definition of Ready (DoR).

| ID epic (da assegnare in tracker) | Workstream | Titolo epic | Dipendenze | DoR (minimo) |
|-----------------------------------|------------|-------------|------------|--------------|
| CRM-P0-A1 | WS-A | Modello entità core + custom fields + integrità referenziale | — | Schema approvato; policy `updatedAt`/sync documentata |
| CRM-P0-A2 | WS-A | Golden record: rilevamento duplicati + merge (API + permessi) | A1, B1 | Ruolo merge definito; audit su merge |
| CRM-P0-B1 | WS-B | RBAC entità + condivisione record (owner/team) | A1 | Matrice permessi v0 in Confluence/Notion |
| CRM-P0-B2 | WS-B | Audit log append-only + campi sensibili (before/after o hash) | B1 | Elenco campi sensibili da legale/prodotto |
| CRM-P0-B3 | WS-B | Export dati soggetto + richiesta cancellazione/anonymize (per policy) | B2 | Testo policy privacy allegato |
| CRM-P0-C1 | WS-C | Email operativa tracciata su record (invio + correlazione) | A1, B1 | Allineamento a [email-operativo-vs-connettori-design](2026-03-19-email-operativo-vs-connettori-design.md) |
| CRM-P0-C2 | WS-C | Calendario: eventi collegati ad attività/record | A1, B1 | Account di test calendar |
| CRM-P0-C3 | WS-C | SSO / IdP (enterprise) | B1 | Metadata IdP disponibili |
| CRM-P0-C4 | WS-C | Webhook **oppure** coda eventi dominio (estensibilità) | A1 | Contratto evento minimo (nome payload, versione) |
| CRM-P0-D1 | WS-D | CRM UX: pipeline, liste, scheda record (flusso AE) | A1, B1 | Wireframe o DS aggiornato |
| CRM-P0-D2 | WS-D | Collaborazione: commenti, feed, allegati su record | B1, D1 | Limiti size/allegati definiti |
| CRM-P0-E1 | WS-E | Forecast + pipeline reporting + attribuzione base | A1, D1 | Definizione “commit” / campi forecast |
| CRM-P0-E2 | WS-E | Handoff lead → opportunità (campi + report funnel base) | E1 | Mapping campi lead/opp approvato |
| CRM-P0-WF | WS-A + WS-D | Workflow/if-then, approvazioni, SLA/escalation, reminder/task ricorrenti | A1, B1 | Catalogo trigger/azioni + idempotenza job |
| CRM-P0-F0 | WS-F | (Prep) Indicizzazione testo per record + flag AI disabilitato | A1, B1, C1 | Nessun modello in prod fino a Fase 4 |

**Deliverable Fase 0:** ticket creati nel tracker con link a questa tabella; sync settimanale cross-WS calendarizzato.

---

## Fase 1 — Gate fondamenta P0 (staging)

### 1.1 Checklist sezione 2 del design (stato su staging)

Compilare **Data**, **Eseguente**, **Esito** (OK / KO / N/A).

#### Modello dati

| # | Voce | Esito | Note |
|---|------|-------|------|
| 1.1.1 | Entità core con `updatedAt` (o versione) coerente per sync | | |
| 1.1.2 | Relazioni account ↔ contatti ↔ opportunità ↔ attività con vincoli API | | |
| 1.1.3 | Campi custom: tipo, obbligatorietà, indicizzazione liste/report | | |
| 1.1.4 | Strategia identità: persona/contatto, multi-account | | |

#### RBAC e condivisione

| # | Voce | Esito | Note |
|---|------|-------|------|
| 1.2.1 | Ruoli CRUD per entità + permessi export/merge/admin campi | | |
| 1.2.2 | Condivisione record: owner, team, visibilità | | |
| 1.2.3 | Separazione admin tenant vs utente operativo | | |

#### Audit e conformità

| # | Voce | Esito | Note |
|---|------|-------|------|
| 1.3.1 | Audit append-only: chi, cosa, quando, record | | |
| 1.3.2 | Campi sensibili: before/after o hash | | |
| 1.3.3 | Export e cancellazione/anonymize secondo policy | | |
| 1.3.4 | Retention log (configurabile o “mai” per legal hold) | | |

#### Integrazioni minime

| # | Voce | Esito | Note |
|---|------|-------|------|
| 1.4.1 | Email legata al record (tracciamento) | | |
| 1.4.2 | Calendario collegato ad attività | | |
| 1.4.3 | SSO | | |
| 1.4.4 | Webhook o coda eventi | | |

### 1.2 Script demo interna (gate uscita Fase 1)

Eseguire su **staging** con due utenti (AE + manager) e ruoli distinti.

| Step | Azione | Esito atteso |
|------|--------|--------------|
| D1 | Crea opportunità con importo e data chiusura | Record visibile solo a permessi corretti |
| D2 | Crea attività collegata | Appare su scheda opportunità e audit |
| D3 | Invia/registra email collegata al record (flusso reale o test) | Evento visibile su timeline + voce audit |
| D4 | Manager apre audit e filtra per record | Voci coerenti con D1–D3 |
| D5 | Utente senza permesso tenta accesso diretto (URL/API) | 403 / negato |

### 1.3 Checklist rapida permessi (penetration light)

| # | Test | Esito |
|---|------|-------|
| P1 | AE vede solo i propri record (se policy) o team | |
| P2 | Revoca ruolo: sessione esistente non espande dati | |
| P3 | Export massivo solo ruolo dedicato | |

**Gate Fase 1:** tutte le righe sez. 1.1–1.2 **OK** o **N/A** motivato; demo D1–D5 **OK**; nessun KO bloccante in P1–P3.

| Ruolo | Nome | Firma gate | Data |
|-------|------|------------|------|
| Product | | | |
| Engineering lead | | | |
| Security / delegate | | | |

---

## Fase 2 — UAT CRM B2B + RevOps light

Eseguire i **5 scenari** su staging o pre-prod; allegare screenshot o ID record in ticket UAT.

### Scenario UAT-1 — Nuovo deal

| Campo | Valore |
|-------|--------|
| Prerequisiti | Utente AE, account esistente o creabile |
| Passi | Crea opportunità → aggiungi contatto ruolo “economic buyer” → crea task con scadenza |
| Attesi | Forecast aggiornato; permessi corretti; audit completo |
| Esito | OK / KO |

### Scenario UAT-2 — Split team / co-selling

| Campo | Valore |
|-------|--------|
| Prerequisiti | Due AE nello stesso team o regola team selling attiva |
| Passi | Assegna secondo owner o team; verifica visibilità entrambi |
| Attesi | Nessun leak verso utente fuori team |
| Esito | OK / KO |

### Scenario UAT-3 — Cambio owner

| Campo | Valore |
|-------|--------|
| Prerequisiti | Opportunità con owner A |
| Passi | Trasferisci a owner B; verifica storico e permessi A vs B |
| Attesi | A perde scrittura se policy; B acquisisce; audit “owner changed” |
| Esito | OK / KO |

### Scenario UAT-4 — Merge duplicato

| Campo | Valore |
|-------|--------|
| Prerequisiti | Due contatti duplicati o flag da sistema |
| Passi | Merge con utente che ha permesso merge; verifica record unificato |
| Attesi | Audit merge; nessuna perdita attività critica |
| Esito | OK / KO |

### Scenario UAT-5 — Revoca permesso

| Campo | Valore |
|-------|--------|
| Prerequisiti | Utente C con accesso a record R |
| Passi | Revoca ruolo o sharing; C tenta accesso a R |
| Attesi | Negato; nessuna cache client che espone dati (refresh hard) |
| Esito | OK / KO |

### Chiusura epic P0 (tracciamento tabella design)

Allineare le epic CRM-P0-* alla tabella “Mappa catalogo → fase” nel design: tutte le righe **P0** devono avere stato **Done** nel tracker prima del go-live Fase 2.

| Area design P0 | Epic di riferimento | Stato tracker |
|----------------|---------------------|---------------|
| Dati (custom, merge) | CRM-P0-A1, A2 | |
| Automazione P0 | CRM-P0-WF | |
| Integrazioni P0 | CRM-P0-C1…C4 + decisione telefonia/e-sign | |
| Analytics P0 | CRM-P0-E1, E2 | |
| Sicurezza P0 | CRM-P0-B1, B2, B3 | |
| Collaborazione P0 | CRM-P0-D2 | |

**Gate Fase 2:** UAT-1…5 **OK**; epic P0 chiuse o esplicitamente deferite con nuova data e approvazione product.

---

## Fase 3 — Ondate P1 incrementali

Ordine dal piano operativo. Per **ogni ondata**: runbook connettore (rate limit, retry, dead letter, mapping campo); owner integrazione; data deploy.

### Ondata P1-W1 — Eventi verso DWH

| Criterio uscita | Sì/No |
|-----------------|-------|
| Contratto schema evento versionato | |
| Ambiente staging ha consumer di test | |
| Alert su error rate > soglia | |

### Ondata P1-W2 — Playbook guidati

| Criterio uscita | Sì/No |
|-----------------|-------|
| Playbook collegati a stadio pipeline | |
| Checklist obbligatoria configurabile | |

### Ondata P1-W3 — Territori, team selling, multi-valuta

| Criterio uscita | Sì/No |
|-----------------|-------|
| Regole territorio documentate | |
| Forecast in valuta corretta con arrotondamento | |

### Ondata P1-W4 — Connettori MAP/ERP prioritari

| Sistema | Mapping campo | Runbook link | Esito |
|---------|---------------|--------------|-------|
| | | | |

### Ondata P1-W5 — Cohort cross-funzione

| Criterio uscita | Sì/No |
|-----------------|-------|
| Definizioni funnel allineate a campi reali | |
| Report ripetibile (stessa query = stessi numeri) | |

### Ondata P1-W6 — Mascheramento + retention GDPR

| Criterio uscita | Sì/No |
|-----------------|-------|
| Campi mascherati per ruolo | |
| Job retention log + eccezione legal hold | |

---

## Fase 4 — Pilot AI (UC-AI-1 / UC-AI-2)

### 4.1 Prerequisiti (pre-canary)

| # | Voce | Esito |
|---|------|-------|
| 4.0.1 | Testo indicizzato per account/opportunità con permessi ereditati | |
| 4.0.2 | Feature flag per tenant pilot | |
| 4.0.3 | Nessuna scrittura automatica su campi critici (solo suggerimento + conferma) | |
| 4.0.4 | Allineamento legale su uso testo / training (se applicabile) | |

### 4.2 Eventi telemetria (nomi canonici)

Payload minimo consigliato: `tenantId`, `userId`, `recordType`, `recordId`, `ts`, `variant` (A/B se presente).

| Nome evento | Quando | Proprietà aggiuntive utili |
|-------------|--------|----------------------------|
| `ai.summary.shown` | Riassunto renderizzato | `sourceCount`, `latencyMs` |
| `ai.summary.feedback` | Thumb up/down | `sentiment`: positive / negative |
| `ai.task_suggestion.shown` | Suggerimento task mostrato | `source`: email / note |
| `ai.task_suggestion.accepted` | Utente conferma creazione task | `taskId` creato |
| `ai.task_suggestion.dismissed` | Utente rifiuta | `reason` opzionale |

### 4.3 Piano canary (4 settimane)

| Settimana | Cosa misurare | Azione se sotto soglia |
|-----------|---------------|-------------------------|
| 1 | Volume eventi, errori, latenza p95 | Rollback flag se errori > soglia |
| 2 | Tempo “mettersi in pari” (campione utenti) | Interviste + fix UX |
| 3 | Tasso accettazione riassunto + conversione task | Tune prompt / fallback |
| 4 | KPI vs target design | Go / no-go estensione |

**Target di riferimento (dal design):**

| KPI | Target |
|-----|--------|
| Tempo medio recap account | −30% vs baseline manuale |
| Feedback positivi riassunto | >70% dopo 4 settimane |
| Task con scadenza da note/email | +15% vs pre-AI |
| Tempo lettura → task salvato | −25% |

### 4.4 Gate uscita pilot

| Voce | Esito |
|------|-------|
| Report KPI firmato product | |
| Nessun incidente P1 su leak permessi / dati | |
| Decisione: estendere rollout / iterare / spegnere | |

---

## Registro revisioni

| Data | Autore | Modifica |
|------|--------|----------|
| 2026-03-19 | — | Prima stesura runbook da piano operativo |
