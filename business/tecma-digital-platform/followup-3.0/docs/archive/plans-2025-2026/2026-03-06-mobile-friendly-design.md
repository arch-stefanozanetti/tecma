# Design mobile-friendly – CRM Followup 3.0

**Data:** 2026-03-06  
**Riferimento:** Report audit `2026-03-06-mobile-audit-report.md` e piano “Audit mobile e roadmap usabilità CRM”.

---

## 1. Obiettivi

- Rendere il CRM **usabile su smartphone** per gli **agenti in movimento**: consultazione rapida, pochi tap, poche form lunghe.
- Allineare le superfici critiche (Login, Agenda, Follow-up, Clienti, Stato unità) a criteri mobile-first senza stravolgere l’esperienza desktop.
- Definire una **roadmap a fasi** eseguibile dopo approvazione, con piano di implementazione dettagliato (task, file, componenti) da produrre in un secondo momento (es. con writing-plans).

---

## 2. Utente target e vincoli

- **Utente:** Agente che usa il CRM da smartphone (viewport ~375px, touch).
- **Vincoli:** Tap target ≥44x44px; form lunghe spezzate in step o sezioni collassabili; liste preferibilmente a card/list su small viewport; drawer/sheet full-screen o quasi su mobile; CTA principali sempre visibili o sticky.

---

## 3. Metodologia e criteri di successo

**Unità di analisi:** una **pagina** = route principale (es. `/clients`, `/requests`, `/calendar`) o vista principale (es. lista vs kanban su Trattative).

**Checklist per pagina (viewport ~375px):**

1. **Navigazione e ingresso**  
   Pagina raggiungibile dalla quick nav mobile o da un numero di tap predefinito; header con titolo leggibile e CTA principale con tap target ≥44px.

2. **Contenuto principale**  
   Liste: evitare tabelle con molte colonne come unica vista su mobile; preferire card/list; scroll orizzontale solo se inevitabile e con affordance chiara. Filtri/ricerca sempre accessibili (es. icona che apre drawer).

3. **Form e azioni**  
   Form lunghe (>1 schermo): step o sezioni collassabili; CTA “Salva”/“Avanti” sticky o sempre visibili. Tap target per bottoni e link ≥44x44px. Drawer/Sheet su small viewport: full-screen o quasi; chiusura con gesto o pulsante chiaro.

4. **Dettaglio entità**  
   Apertura da lista in 1 tap; azioni primarie (chiama, cambia stato) in evidenza e tap-friendly; timeline/attività leggibili senza zoom.

5. **Casi particolari**  
   Calendario: giorno/settimana usabili con tap/swipe; creazione evento con form breve o step. Kanban: colonne scrollabili con indicatore; card trascinabili o azioni da menu. Admin/Report: priorità più bassa; annotare “tabella/form lunga” e classificare medium/low.

**Criteri di successo dell’audit (già soddisfatti dal report):**

- Ogni pagina/flow recensito con checklist ripetibile.
- Documento di report con elenco pagine, priorità, problemi per pagina, raccomandazioni ad alto livello.
- Roadmap a fasi in testo (non codice).

---

## 4. Mappa priorità (sintesi)

- **P0 (blocker):** Impediscono l’uso ragionevole su smartphone (login, liste illeggibili, CTA non tappabili).
- **P1 (high):** Journey critici (Agenda, Follow-up, Clienti, Stato unità) con problemi chiari (form lunghe, troppi tap, tabelle inutilizzabili).
- **P2 (medium):** Altre pagine operative (Cockpit, Inbox, Customer360, Progetti, flussi secondari).
- **P3 (low):** Admin, Integrazioni, Report, pagine poco usate da agenti in movimento.

Dettaglio in `2026-03-06-mobile-audit-report.md`.

---

## 5. Roadmap a fasi (solo testo/storie)

La roadmap indica **cosa fare** e **in che ordine**. Il piano di implementazione (task, file, componenti) sarà creato **dopo approvazione** (es. invocando writing-plans per la Fase 1).

### Fase 1 – P0 + P1 (journey agenti)

- **Login:** layout single-column su viewport piccoli; CTA e campi con tap target adeguato; nessuna colonna laterale nascosta.
- **Calendario (Agenda):** vista giorno default su mobile; tap su slot per creare evento; form evento breve o a step; navigazione giorno con swipe/tap.
- **Trattative (Follow-up):** default vista Kanban su mobile; indicatore per scroll orizzontale colonne; form “Nuova trattativa” in step o drawer full-screen; drawer dettaglio e azioni tap-friendly.
- **Clienti:** vista card/list su viewport &lt;768px (in alternativa o in aggiunta alla tabella); filtri in drawer (già presente); CTA “Aggiungi cliente” sempre visibile; form crea/modifica in step o drawer full-screen.
- **Appartamenti (Stato unità):** vista card/list su mobile; drawer filtri; CTA “Crea appartamento” e azioni principali sticky/visibili; form modifica in drawer full-screen; sezioni lunghe collassabili.
- **Create Apartment / Create Apartment HC / Edit Apartment HC:** step brevi; CTA “Avanti”/“Salva” sticky; riepilogo prima di submit dove applicabile.
- **Dettaglio cliente / appartamento / trattativa:** azioni primarie (chiama, cambia stato) in evidenza con tap target ≥44px; timeline/attività leggibili.

### Fase 2 – P2 (resto operativo)

- **Cockpit (Home):** su mobile card in stack verticale o swipe con indicatore; allineamento con quick nav.
- **Inbox:** tap target per icona e voci; drawer notifiche usabile.
- **Customer360:** accesso in 1 tap da contesto; azioni e tabelle/timeline adattate.
- **Progetti:** card/tab usabili su small viewport.
- **Altri flussi:** Associa apt–cliente, Complete flow, Catalog HC, Template config, AI Approvals, Price &amp; Availability: applicare pattern comuni (drawer filtri, card dove c’è tabella wide, CTA sticky, form in step/drawer).

### Fase 3 – P3 (admin e strumenti) o backlog

- **Workflow config, Workspaces, Users, Email Flows, Audit, Report, Integrazioni, Product Discovery, Releases:** interventi a priorità bassa; dove ci sono tabelle wide: scroll orizzontale con affordance o vista card/list; form lunghe in step o sezioni. Workflow config può restare desktop-first con eventuale vista read-only semplificata.

---

## 6. Fasi successive all’audit (processo)

1. **Approvazione** del report (`2026-03-06-mobile-audit-report.md`) e di questa roadmap da parte di product/team.
2. **Scrittura piano di implementazione:** per la Fase 1 invocare writing-plans (o equivalente) per tradurre le raccomandazioni in task concreti (file, componenti, pattern).
3. **Implementazione a fasi:** Fase 1 prima, poi Fase 2 e Fase 3, con test manuali mobile dopo ogni gruppo di modifiche.

In questa fase **non** viene scritto codice: solo audit, report, priorità e roadmap testuale. Il codice e i task dettagliati seguiranno dopo l’approvazione.

---

## 7. Riferimenti

- Piano: “Audit mobile e roadmap usabilità CRM” (allegato).
- Report audit: `docs/plans/2026-03-06-mobile-audit-report.md`.
- UX rules interno: `docs/UX_RULES_INTERNAL_PORTAL.md`.
- Componenti: `fe-followup-v3/src/core/shared/PageTemplate.tsx` (quick nav mobile, Sheet, touchFriendly), Drawer/Sheet in clients, apartments, requests.

---

*Documento generato nell’ambito del piano “Audit mobile e roadmap usabilità CRM”.*
