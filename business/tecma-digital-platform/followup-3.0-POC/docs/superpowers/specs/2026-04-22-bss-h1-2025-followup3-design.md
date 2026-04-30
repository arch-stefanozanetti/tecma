# Design spec — Allineamento funzioni “Insight BSS H1 2025” su FollowUp 3.0

**Data:** 2026-04-22  
**Stato:** approvato per refinement / implementazione incrementale  
**Riferimenti:** [FOLLOWUP_3_MASTER.md](../../FOLLOWUP_3_MASTER.md), [PIANO_GLOBALE_FOLLOWUP_3.md](../../PIANO_GLOBALE_FOLLOWUP_3.md), [08-ai-first-positioning.md](../../executive/08-ai-first-positioning.md)

---

## 1. Decisione di priorità (To-do: align-priority)

### Scelta: approccio **B — Adoption-first** (anno 1)

| Approccio | Uso |
|-----------|-----|
| **B (primario)** | Killer path per **vendor + segreteria**: cockpit unificato, calendario affidabile, report/export manager, responsive mobile; poi integrazioni guidate. |
| **A (slice)** | Parità legacy / FASE aggiuntive **solo** dove vincolato da contratto, go-live bloccante o cliente “intenso” già in rollout — caso per caso nel piano globale. |
| **C (dopo)** | Integrazione-first **dopo** almeno un connettore verticale stabile + UX wizard; evitare catalogo parallelo senza entitlement e supporto. |

**Motivazione:** il documento H1 2025 attribuisce polarizzazione ad adozione e frizione operativa; il north star FollowUp 3.0 (“semplice ogni giorno”) richiede **time-to-value** prima della parità monolite.

---

## 2. MVP Cockpit “Oggi” (To-do: cockpit-slice)

### Obiettivo utente

Un solo posto che risponde a: *Cosa devo fare oggi?* — senza saltare tra calendario, lista task e richieste senza contesto.

### Scope MVP (v1 spec)

| Elemento | Contenuto | Note |
|----------|------------|------|
| **Eventi** | Prossimi N eventi (oggi + domani configurabile) da sorgente dominio unificata + eventuali esterni (es. Outlook) come già in calendario | Riuso `queryCalendar` / modello eventi documentato in Fase 5 |
| **Scadenze richieste** | Richieste con `nextActionDue` / SLA o stato che richiede follow-up (definizione dominio da allineare a `tz_requests`) | Card con link a scheda richiesta |
| **Task / to-do** | Lista task aperti assegnati all’utente o al workspace (entità task esistente o equivalente backlog) | Se il modello task non è unificato, MVP = “promemoria” legati a richiesta/evento |

### UX

- Una **sezione above the fold** nella home con tre blocchi chiari: **Appuntamenti** | **Da fare** | **Richieste calde** (etichette riviste con copy non tecnico).
- **Preset ruolo** (opzionale v1.1): vista default diversa per vendor vs backoffice (stesso dato, priorità diverse).

### Acceptance criteria (testabili)

1. Dato un utente con almeno un evento oggi, quando apre la home allora vede l’evento in elenco con orario e titolo e CTA “Apri calendario” / “Apri dettaglio”.
2. Dato una richiesta con scadenza entro le 24h (o regola SLA definita), quando apre la home allora la richiesta compare nella sezione prioritaria con link diretto al dettaglio.
3. Dato un utente senza eventi e senza scadenze, quando apre la home allora vede stato vuoto esplicito e CTA “Nuova richiesta” / “Nuovo evento” (coerente con permessi).
4. La home non richiede più di **2 click** da l’elenco cockpit alla **scheda** richiesta/cliente collegata (happy path).

### Metriche di successo (PO)

| Metrica | Definizione | Target indicativo (post-rilascio) |
|---------|-------------|-----------------------------------|
| **Lead → prima azione** | Tempo da creazione lead/richiesta a prima modifica di stato, nota o evento da utente umano | Riduzione vs baseline misurata in telemetry |
| **% richieste SLA** | % richieste con `nextActionDue` rispettato entro finestra (es. 24h/48h) | Incremento vs baseline; evento `cockpit.request.sla_ok` in catalogo telemetry |
| **Engagement cockpit** | % sessioni con click da sezione cockpit entro 60s dall’ingresso | Da definire con prodotto dopo instrumentazione |

**Riferimento metriche strategiche:** [08-ai-first-positioning.md](../../executive/08-ai-first-positioning.md) (tempo lead → prima azione, conversione visita → preventivo, richieste ad alta priorità entro SLA).

---

## 3. Backlog Fase 5 — Calendario (To-do: calendar-fase5)

Allineato a [FASE5_CALENDAR_SYNC.md](../../deliverables/FASE5_CALENDAR_SYNC.md).

| # | Voce backlog | Priorità | Definition of Done (sintesi) |
|---|--------------|----------|------------------------------|
| F5.1 | **Unificare scrittura eventi** da CalendarPage, timeline e altre UI verso **una sola sorgente** dominio (`tz_events` o consolidato) | P0 | Creazione da qualsiasi entry point persiste lo stesso schema; test API/UI su doppio invio |
| F5.2 | **Sync incrementale + job** (non solo fetch on-demand) | P1 | Job schedulato o queue; documentazione errori e retry |
| F5.3 | **Refresh token** — cifratura at-rest, rotazione, gestione scadenza/revoca | P0 | Nessun secret in chiaro; runbook aggiornato |
| F5.4 | **Secondo provider** (Gmail / Google Calendar o equivalente) se in scope commerciale | P1 | Stesso contratto FE `queryCalendar` + merge `source`; OAuth documentato |
| F5.5 | **Gestione errori scope** e messaggi utente (ricollega account) | P1 | Stato integrazione visibile in UI Integrazioni |
| F5.6 | **Parità funzionale vs legacy** (non UI 1:1) dove richiesto dal rollout | P2 | Matrice casi in piano globale |

**Ordine suggerito (già in Fase 5 doc):** F5.1 → F5.3 → F5.2 → F5.4 → F5.5 → F5.6.

---

## 4. Backlog Fase 4 — Report (To-do: reports-fase4)

Allineato a [FASE4_REPORTS_DASHBOARDS.md](../../deliverables/FASE4_REPORTS_DASHBOARDS.md).

| # | Voce backlog | Priorità | Definition of Done (sintesi) |
|---|--------------|----------|------------------------------|
| R4.1 | **Editor filtri avanzato** per definizione report (oltre preferiti attuali) | P1 | Salvataggio in `tz_report_definitions` con tutti i filtri necessari ai casi manager; validazione lato BE |
| R4.2 | **Export file** (CSV/XLSX o formato scelto) con **colonne/parametri** selezionabili e coerenti con definizione salvata | P1 | File scaricato contiene intestazioni + dati attesi; nessun dato fuori scope workspace |
| R4.3 | **Preset colonne** per tipo report (riduce curva manager) | P2 | 2–3 preset documentati |
| R4.4 | **AI opt-in workspace** centralizzato (se governance aggiuntiva richiesta) | P2 | Coerente con spike AI e permessi `integrations` / dedicato |

**Vincoli:** mantenere audit su snapshot pubblici già implementato; nuovi export loggati se contengono dati sensibili (`tz_security_audit` o `tz_audit_log` — allineare a policy esistente).

---

## 5. Spike — Template comunicazioni (email/PDF) per workspace (To-do: comms-templates)

### Obiettivo

Estendere la leva “output verso cliente” oltre il [preventivo digitale Fase 2](../../deliverables/FASE2_DIGITAL_QUOTE.md): template **per workspace** riusabili (email di cortesia, invio documenti, follow-up standard).

### Domande da chiudere nello spike (max 2 giorni analisi)

1. **Canale:** solo email outbound (SMTP/Twilio SendGrid) vs anche PDF attachment riusando pipeline quote?
2. **Variabili:** subset `{clientName, projectName, vendorName, appointmentDate, listingRef}` — elenco chiuso v1?
3. **Permesso:** quale chiave RBAC (`communications.send` o nuovo `templates.update`)?
4. **Audit:** log invio (chi, quando, templateId, destinatario hash) senza body completo se policy privacy.

### Output atteso dello spike

- Decisione go/no-go v1 e **max 3 template** pilota.
- Wireframe low-fi: lista template → anteprima variabili → test invio a indirizzo di staging.
- Aggiornamento OpenAPI / piano globale § se procede.

---

## 6. Primo connettore verticale post-entitlement (To-do: connector-one)

Allineato a [FASE6_CONNECTORS_UX.md](../../deliverables/FASE6_CONNECTORS_UX.md) e Fase 0.2 entitlement.

### Raccomandazione prodotto: **DocuSign** (primario)

**Perché:** verticale real estate; firma su preventivo/contratto/consegna; chiaro valore per vendor e cliente; riduce “strumenti esterni” citati nel documento H1 2025.

**Definition of Done (connettore DocuSign v1)**

1. Wizard in **Integrazioni** con OAuth o chiave integration documentata; stato connesso / errore.
2. Almeno **un flusso** end-to-end: es. “invia per firma” da trattativa o preventivo con envelope creato e stato sincronizzato in UI.
3. **Entitlement:** funzione visibile solo se workspace abilitato; CTA disabilitate senza permesso (pattern già in Fase 0.1).
4. **Audit:** creazione/revoca envelope e download documento firmato tracciati.
5. Runbook operativo (errori comuni, rinnovo token).

### Alternativa (se priorità è acquisizione lead)

**Meta Lead Ads** o **Google LSA** — DoD analogo: OAuth, mapping campo → contatto/richiesta, idempotenza webhook, entitlement.

**Esplicitamente dopo:** Zapier/Make come “secondo connettore” per non diluire supporto prima che il primo sia stabile.

---

## 7. Regole visibilità cliente/unità (To-do: visibility-rules)

### Policy: **solo dopo evidenza pilot**

Il RBAC modulo×azione ([FASE01](../../deliverables/FASE01_USER_ACCESS_RBAC.md)) resta la baseline.

**Trigger per aprire un epic dedicato**

- Almeno **2 pilot** richiedono segregazione per **stesso dataset** (es. vendor A non vede clienti di vendor B sullo stesso progetto).
- Requisito legale / contrattuale scritto (NDA multi-agenzia).

**Criteri di accettazione (se in scope)**

1. Regola esplicita: visibilità per **vendor/team** o per **attributo** su `tz_clients` / `tz_requests` (da modellare).
2. Ogni lettura lista e dettaglio rispetta regola lato **BE** (non solo nascondere in FE).
3. Test di regressione su export e report (nessuna fuga via snapshot).

**Fuori scope fino a trigger:** evitare over-engineering e duplicazione con multi-workspace già possibile.

---

## 8. Piano implementazione (sintesi) (To-do: spec-doc)

Ordine incrementale allineato al piano allegato “BSS H1 2025 su FU3”:

1. **Cockpit unificato** (sezione MVP §2) — dipende da modello eventi/task; coordinare con Wave home esistente in [FOLLOWUP_3_MASTER.md](../../FOLLOWUP_3_MASTER.md) Wave 3/7.
2. **F5.1 + F5.3** calendario — fondamenta per affidabilità.
3. **R4.1 + R4.2** report — sblocca voce manager del documento 2025.
4. **Spike template comunicazioni** §5 — gate go/no-go.
5. **Connettore DocuSign** (o alternativa §6) — un solo connettore fino a stabilità.
6. **Visibilità entità** §7 — solo se trigger pilot.

**Prossimo passo engineering:** usare la skill `writing-plans` (o equivalente interno) per spezzare §2 in task BE/FE con path file e test, senza modificare il file di piano Cursor allegato dall’utente.

---

## Checklist chiusura documento

- [x] Approccio prioritario documentato (B + slice A/C)
- [x] MVP cockpit con AC e metriche
- [x] Backlog Fase 5 e Fase 4 tabellare
- [x] Spike template comunicazioni
- [x] Connettore raccomandato + DoD + alternativa
- [x] Regole visibilità condizionate a pilot
- [x] Ponte a piano implementazione dettagliato
