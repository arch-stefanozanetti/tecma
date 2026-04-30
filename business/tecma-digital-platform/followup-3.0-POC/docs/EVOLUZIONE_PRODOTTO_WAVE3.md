# Evoluzione prodotto: perché sembra basico e come procedere

**Riferimento:** [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md) — wave e principi.

---

## Perché il CRM sembra “molto basico”

- **Wave 3 (UX core) è ancora in corso.** Abbiamo liste clienti/appartamenti con filtri, ricerca e scheda dettaglio (progressive disclosure), ma mancano i flussi che l’utente si aspetta ogni giorno:
  - **Creare e modificare un cliente** (il pulsante “Aggiungi cliente” non apre ancora un form).
  - **Modificare un appartamento** dalla scheda dettaglio (solo lettura oggi).
  - **Creare e modificare eventi** in calendario (oggi solo lettura).
- La **home (Cockpit)** c’è e ha senso (“cosa fare oggi”), ma le azioni suggerite usano ancora fallback mock se l’API AI non restituisce dati; le CTA devono portare in modo coerente a Clienti / Calendario / Associa.
- Il **piano** prevede volutamente “poche funzioni chiare” prima di aggiungere complessità: il “basico” è intenzionale in Wave 3, ma va **completato** (crea/modifica dove serve) per non deludere l’utente.

---

## Tenere la barra dritta: ordine delle wave

- **Non saltare wave.** Il MASTER impone: prima si chiude Wave 3, poi Wave 4 (Requests/Deals), Wave 5 (API riusabili), Wave 6 (auth hardening), Wave 7 (AI/automazioni).
- **Wave 3 = “UX core: poche funzioni, chiare e utilizzabili”.**  
  Acceptance:
  1. Cockpit action-first: l’utente capisce in pochi secondi cosa fare dalla home.
  2. Liste e schede: filtri, ricerca, dettaglio **e** creazione/modifica cliente e appartamento in pochi step.
  3. Calendario: vista multiprogetto + creazione/modifica evento semplice.

---

## Cosa fare subito (checklist operativa)

| # | Task | Dove | Acceptance |
|---|------|------|------------|
| 1 | **Crea/Modifica Cliente** | ClientsPage: “Aggiungi cliente” → form/dialog; Sheet dettaglio → “Modifica” | Form essenziale (nome, email, telefono, stato); API create/update; nessun muro di campi |
| 2 | **Modifica Appartamento** | ApartmentsPage: Sheet dettaglio → CTA “Modifica” → pagina/form esistente | Utente può aggiornare dati appartamento dal contesto lista |
| 3 | **Cockpit CTA coerenti** | CockpitPage: link “Calendario”, “Clienti”, “Associa” dalle card | Ogni azione porta alla sezione giusta |
| 4 | **Calendario: nuovo evento + modifica** | CalendarPage: “Nuovo evento” + click evento → form breve | Titolo, inizio, fine, progetto/tipo; salvataggio |

Dopo 1–4, Wave 3 è chiusa. Si può pianificare **Wave 4** (modello Request/Deal, lista/kanban trattative, rent+sell unificato).

---

## Dopo Wave 3: cosa rende il CRM “meno basico”

- **Wave 4:** Trattative/richieste come entità first-class (lista/kanban, dettaglio, stati). È il cuore “deal” del CRM.
- **Wave 5:** API riusabili (listing, export) per siti e preventivatori.
- **Wave 6:** Auth robusta (refresh token, logout, audit).
- **Wave 7:** Suggerimenti AI e approvazioni senza scrivere da soli.

Rispettando quest’ordine il prodotto evolve in modo coerente con la visione (semplice, action-first, estendibile) senza accumulare debito o confusione.
