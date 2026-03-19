# CRM UX Interaction Design

> **Data:** 2025-03-06  
> **Stato:** Approvato  
> **Piano implementazione:** da creare con writing-plans

## Obiettivo

Trasformare il CRM da pattern "form di compilazione" a interazioni più efficaci: **toggle card/tabella**, **edit inline**, **creazione wizard step-by-step**. Pattern unificato su tutte le entità (clienti, appartamenti, progetti, trattative).

## Approccio scelto: A

- Toggle Card/Table per scegliere la vista
- Edit inline in entrambe le viste (clic su campo → input → salva su blur/Invio)
- Creazione con wizard step-by-step invece di form lunghi
- Drawer/Sheet solo per azioni complesse o dettaglio completo

---

## Sezione 1: Toggle vista (Card / Tabella)

### Comportamento

- Ogni pagina lista (Clienti, Appartamenti, Progetti, Trattative) ha un toggle/tab **Card | Tabella** nella toolbar, accanto a ricerca e filtri.
- Preferenza salvata in `localStorage` per pagina (es. `clients-view-mode: "card"`).
- **Vista Card**: griglia responsive (1 col mobile, 2-3 desktop), card con `glass-panel rounded-ui`, campi principali visibili, azioni rapide.
- **Vista Tabella**: tabella esistente con `thead`/`tbody`, stessi dati.

### Posizione UI

- Nella barra superiore del pannello contenuto, accanto a Cerca e Filtri: icona o tab `[LayoutGrid] Card` | `[List] Tabella`.

### Note

- **RequestsPage**: ha già Lista/Kanban. Estendere a Lista | Card | Kanban (3 opzioni) oppure Card e Tabella come sottoviste di "Lista". Decisione: Lista = toggle interno Card/Table, Kanban resta separato.

---

## Sezione 2: Edit inline

### Comportamento

- Clic su un campo modificabile (nome, email, stato, prezzo, ecc.) → il campo diventa input.
- Salvataggio: `onBlur` oppure `Enter`. `Escape` annulla.
- Feedback: stato loading durante save, toast su successo/errore.
- Campi editabili inline: quelli "critical" per l'entità (nome, email, telefono, stato per cliente; codice, prezzo, stato per appartamento; stato per trattativa; ecc.).

### Implementazione

- Componente `EditableField` riutilizzabile: props `value`, `onSave`, `placeholder`, `type` (text/select), `options` per select.
- Gestione stato: `editingId` + `draftValue` a livello pagina, o stato locale nel componente.

### Vincoli

- Solo token design system. Nessun nuovo colore/font.
- Accessibilità: focus management, aria-labels.

---

## Sezione 3: Creazione con wizard

### Comportamento

- "Nuovo cliente" / "Nuovo appartamento" / "Nuova trattativa" apre un wizard a step invece di un form unico.
- Step 1: campi essenziali (es. cliente: nome + progetto; appartamento: codice + nome + modalità; trattativa: cliente + appartamento + tipo).
- Step 2: campi secondari (contatti, stato, prezzi, ecc.).
- Step 3 (opzionale): campi aggiuntivi o conferma.
- Navigazione: Avanti/Indietro, oppure stepper cliccabile.
- Salvataggio: al termine dell'ultimo step, o "Salva e continua" se ha senso.

### Entità

| Entità      | Step 1              | Step 2                    |
|-------------|---------------------|---------------------------|
| Cliente     | Nome, Progetto      | Email, telefono, stato    |
| Appartamento| Codice, Nome, Modalità | Prezzo, piano, mq, stato |
| Trattativa  | Cliente, Appartamento, Tipo | Stato, ruolo cliente |
| Progetto    | Nome, Modalità      | (eventuali config)       |

---

## Sezione 4: Drawer/Sheet residuale

### Quando usare

- **Dettaglio completo**: click su riga/card → Sheet o pagina dettaglio (ClientDetailPage, ApartmentDetailPage).
- **Campi aggiuntivi**: se l'entità ha many custom fields, Drawer con sezioni `glass-panel` per modifica estesa.
- **Bulk actions**: selezione multipla + azioni da Drawer o dropdown.
- **Azioni complesse**: es. "Associa cliente ad appartamento" con wizard o form strutturato.

### Quando evitare

- Modifica di 1-2 campi → edit inline.
- Creazione → wizard.

---

## Sezione 5: Pattern per entità

### Clienti (ClientsPage)

- Toggle: Card | Tabella (la "Tipologia tabella" contacts/leads resta come filtro separato).
- Edit inline: nome, email, telefono, stato.
- Creazione: wizard 2 step.
- Card: nome, email, stato, progetto, azioni (modifica, dettaglio).

### Appartamenti (ApartmentsPage)

- Toggle: Card | Tabella.
- Edit inline: codice, nome, prezzo, stato.
- Creazione: wizard 2 step (o redirect a CreateApartmentPage con wizard).
- Card: codice, nome, piano, mq, prezzo, stato, azioni.

### Progetti (ProjectsPage)

- Toggle: Card | Tabella.
- Edit inline: nome, modalità.
- Creazione: da WorkspacesPage o wizard breve.
- Card: nome, modalità, link config.

### Trattative (RequestsPage)

- Vista: Lista (con toggle Card/Table interno) | Kanban.
- Edit inline in lista/card: stato (dropdown), note brevi.
- Creazione: wizard 2 step.
- Kanban: già visuale; eventuale edit inline su card (es. stato).

---

## Vincoli tecnici

- Solo token design system: `--primary`, `--muted`, `--border`, `--foreground`, `--background`, `--card`, Lato, Ivy Journal.
- Componenti: `glass-panel`, `rounded-ui`, `border-border`, `bg-card`, `text-muted-foreground`.
- Nessun nuovo colore, font o variabile CSS.

---

## Prossimi passi

1. Invocare writing-plans per piano di implementazione dettagliato.
2. Implementare in ordine: ViewModeToggle → vista Card per ClientsPage → edit inline → wizard creazione.
3. Replicare pattern su ApartmentsPage, ProjectsPage, RequestsPage.
