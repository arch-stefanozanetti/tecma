# Report audit mobile – CRM Followup 3.0

**Data:** 2026-03-06  
**Utente target:** Agenti in movimento (smartphone): consultazione rapida, pochi tap, poche form lunghe.  
**Viewport di riferimento:** ~375px.  
**Scope:** Tutte le route/pagine operative + Admin, Integrazioni, Report.

---

## Riepilogo esecutivo

L’audit ha analizzato le pagine del CRM secondo la checklist mobile (navigazione, contenuto, form/azioni, dettaglio entità, casi particolari). Sono stati classificati i problemi in **P0 (blocker)**, **P1 (high)**, **P2 (medium)**, **P3 (low)** e prodotta una mappa priorità e una roadmap a fasi testuale.

**Top-5 blocker (P0)**  
1. **Login** – Form a step (email/password + workspace) ok, ma su viewport piccolo il layout a due colonne nasconde contenuto; CTA e tap target da verificare su 375px.  
2. **Clienti** – Lista solo tabella `min-w-[900px]`: scroll orizzontale obbligatorio, nessuna vista card; il journey “consultazione rapida” è compromesso.  
3. **Appartamenti** – Lista solo tabella `min-w-[1020px]`: stesso problema della lista clienti, peggio per numero di colonne.  
4. **Trattative (table)** – Tabella `min-w-[700px]`; vista Kanban presente ma colonne fisse 280px con scroll orizzontale senza chiara affordance.  
5. **Calendario** – Griglia giorno/settimana/mese con `TIME_COL_WIDTH` e colonne fisse; usabilità tap/swipe e creazione evento da verificare su small viewport.

**Top-10 high (P1)**  
- Clienti: barra filtri/cerca su più righe, CTA “Aggiungi cliente” e “Altro” in riga; drawer dettaglio e form crea/modifica in Drawer/Sheet (buono) ma form lunghi.  
- Appartamenti: stessi pattern (filtri, “Crea appartamento”, “Verifica dati”, “Altro”); drawer dettaglio; form modifica in Drawer.  
- Trattative: form “Nuova trattativa” con clienti/appartamenti; drawer dettaglio e azioni; vista Kanban con card tap-friendly ma scroll orizzontale colonne.  
- Calendario: filtri (source, project) in drawer/sheet; form evento in modal/drawer.  
- Cockpit: card orizzontali `overflow-x-auto` con `min-w-[200px]`; nessuna quick nav diretta (si passa da Home).  
- Create Apartment / Create Apartment HC / Edit Apartment HC: wizard multi-step, form lunghi; priorità alta per journey agenti.  
- Dettaglio cliente/appartamento/trattativa: azioni primarie (chiama, cambia stato) da verificare per tap target ≥44px e visibilità.

---

## Mappa priorità

| Livello | Definizione | Esempi |
|--------|-------------|--------|
| **P0 (blocker)** | Impediscono l’uso ragionevole su smartphone | Login illeggibile, liste illeggibili (solo tabella wide), CTA non tappabili |
| **P1 (high)** | Journey critici (Agenda, Follow-up, Clienti, Stato unità) con problemi chiari | Form lunghe, troppi tap, tabelle inutilizzabili, filtri nascosti |
| **P2 (medium)** | Altre pagine operative con problemi gestibili | Cockpit, Inbox, Customer360, Progetti, dettagli con tabelle complesse |
| **P3 (low)** | Admin, Integrazioni, Report, pagine poco usate da agenti in movimento | Tabelle/forme lunghe annotate, miglioramenti non critici |

---

## Tabella audit per pagina

| ID | Nome | Route / Sezione | Priorità | Problemi (checklist) | Raccomandazione |
|----|------|------------------|----------|----------------------|-----------------|
| 1 | Login | `/login` | P0 | Layout due colonne su small viewport; step 2 (workspace) con Select; tap target da verificare. | Layout single-column su &lt;768px; CTA e input ≥44px; evitare colonna laterale nascosta. |
| 2 | Scelta progetto (post-login) | ProjectAccessPage | P0/P1 | Lista progetti e workspace in area scrollabile; su mobile può essere lunga. | Lista compatta o card; CTA “Continua” sticky. |
| 3 | Home / Cockpit | cockpit | P2 | Card in `overflow-x-auto` con `min-w-[200px]`; nessun quick nav dedicato. | Su mobile: stack verticale o swipe con indicatore; quick nav già in barra bottom. |
| 4 | Calendario (Agenda) | calendar | P0 | Griglia con colonne fisse; vista giorno/settimana/mese; creazione evento in form. | Vista giorno default su small viewport; tap su slot per creare; form evento breve o step; swipe per cambiare giorno. |
| 5 | Trattative (Follow-up) | requests | P0/P1 | Tabella `min-w-[700px]`; vista Kanban con colonne 280px e `overflow-x-auto`; form nuova trattativa con clienti/apt. | Su mobile: default Kanban con indicatore scroll; card già tap-friendly; form in step o drawer full-screen. |
| 6 | Clienti | clients | P0 | Tabella unica `min-w-[900px]`; filtri e ricerca su più righe; Drawer dettaglio e form crea/modifica. | Vista card/list per viewport &lt;768px; filtri in drawer già presente; CTA “Aggiungi” sempre visibile; form in step. |
| 7 | Appartamenti (Stato unità) | apartments | P0 | Tabella `min-w-[1020px]`; molte colonne; filtri, Crea, Verifica dati, Altro. | Vista card/list su mobile; drawer filtri; CTA sticky; form modifica in drawer full-screen. |
| 8 | Crea appartamento | createApartment | P1 | Wizard multi-step; form lunghi; sessionStorage per stato. | Step brevi; CTA “Avanti”/“Salva” sticky; riepilogo prima di submit. |
| 9 | Crea appartamento HC | createApartmentHC | P1 | Come sopra. | Stesso pattern step + sticky CTA. |
| 10 | Modifica appartamento HC | editApartmentHC | P1 | Form modifica in contesto wizard/flusso. | Drawer/Sheet full-screen su mobile; sezioni collassabili. |
| 11 | Associa apt–cliente | associateAptClient | P2 | Form e lista associazioni; ricerca. | Filtri in drawer; tap target per righe. |
| 12 | Complete flow | completeFlow | P2 | Flusso multi-step. | Sticky CTA; step brevi. |
| 13 | Catalog HC | catalogHC | P2 | Lista/tabella. | Vista card su mobile se tabella wide. |
| 14 | Template config | templateConfig | P2 | Configurazione. | Form in sezioni o drawer. |
| 15 | AI Approvals | aiApprovals | P2 | Lista e azioni. | Tap target e azioni in evidenza. |
| 16 | Progetti | projects | P2 | Overview e tab; tabelle/card. | Card stack; tab swipeabile. |
| 17 | Workflow config | workflowConfig | P3 | Canvas con nodi (`minWidth`/`minHeight`); desktop-oriented. | Solo annotazione “desktop-first”; eventuale vista read-only semplificata. |
| 18 | Workspaces | workspaces | P3 | Admin; tabelle e form. | Tabelle: scroll orizzontale con indicatore o card. |
| 19 | Users | users | P3 | Admin; lista e form. | Idem. |
| 20 | Email Flows | emailFlows | P3 | Admin. | Idem. |
| 21 | Audit log | audit | P3 | Tabella `overflow-x-auto`. | Priorità bassa; indicatore scroll. |
| 22 | Report | reports | P3 | Tabella/tabelle `overflow-x-auto`. | Priorità bassa; export per consultazione su mobile. |
| 23 | Price &amp; Availability | priceAvailability | P2 | Griglia con `min-w` per celle; sticky colonna. | Scroll orizzontale con affordance; compact mode già presente. |
| 24 | Integrazioni | integrations | P3 | Tab (API, Connettori, Comunicazioni); tabelle. | Tab e tabelle: stessi pattern. |
| 25 | Product Discovery | productDiscovery | P3 | Strumento. | Annotazione medium/low. |
| 26 | Releases | releases | P3 | Contenuto informativo. | Priorità bassa. |
| 27 | Inbox | (header) | P2 | Icona in header; navigazione a path. | Tap target ≥44px; drawer notifiche. |
| 28 | Customer360 | customer360 | P2 | Vista dettaglio cliente/contesto; possibili tabelle. | Dettaglio 1 tap da lista; azioni in evidenza. |

---

## Riepilogo per priorità

- **P0:** Login, Calendario, Trattative (table), Clienti, Appartamenti (liste solo tabella wide, usabilità compromessa).
- **P1:** Journey agenti (stesse pagine) con focus su form lunghe, troppi tap, drawer/form; Create/Edit Apartment (HC); dettaglio cliente/trattativa/apt.
- **P2:** Cockpit, Inbox, Customer360, Progetti, Create Apartment steps, Associa apt–cliente, Complete flow, Catalog HC, Template config, AI Approvals, Price &amp; Availability.
- **P3:** Workflow config, Workspaces, Users, Email Flows, Audit, Report, Integrazioni, Product Discovery, Releases.

---

## Elementi positivi rilevati

- **Quick nav mobile** in PageTemplate: barra bottom con Agenda, Follow-up, Clienti, Stato unità (4 tap dalla root); Sheet laterale per menu completo con `touchFriendly` (min-h-11).
- **Drawer/Sheet** usati per dettaglio e form in Clienti, Appartamenti, Trattative; FiltersDrawer per filtri.
- **Trattative:** vista Kanban con card tappabili oltre alla tabella.
- **Calendario:** vista day/week/month e form evento in modal/drawer.
- **SideNav** in Sheet su mobile con stessi link della sidebar desktop.

---

## Prossimi passi (roadmap testuale)

- **Fase 1:** Interventi su P0 + P1 (Login, Calendario, Trattative, Clienti, Appartamenti, Create/Edit Apartment, dettagli).  
- **Fase 2:** P2 (Cockpit, Inbox, Customer360, Progetti, altri flussi operativi).  
- **Fase 3:** P3 (admin e strumenti) o backlog.

La roadmap non contiene codice: indica cosa fare e in che ordine. Il piano di implementazione (task, file, componenti) sarà creato dopo approvazione (es. con writing-plans) per la Fase 1.

---

*Documento generato nell’ambito del piano “Audit mobile e roadmap usabilità CRM”.*
