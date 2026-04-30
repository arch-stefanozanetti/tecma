# Wave per l’import delle componenti del design system Figma

Definisce l’ordine e le wave con cui importare in codice (fe-followup-v3) le pagine/componenti del file Figma **DS — Tecma Software Suite**, rispettando il piano di evoluzione (Wave 2 design system, Wave 3 UX core).

**Riferimento Figma:** file key `ZRftnYLwNGRshiXEkS7WGM` (DS — Tecma Software Suite). Le “componenti” sono le **pagine** del file.

**Link e node-id:** i link Figma (con `node-id`) **non** vanno forniti tutti in anticipo. Verranno **richiesti di volta in volta** quando si inizia l’implementazione di una singola componente (es. “per implementare Button servono file key e node-id: incolla l’URL della pagina Button dal Figma”).

---

## DS Wave 1 — Token e foundation (completata)

- Design Tokens / Variables  
- Typography  

**Acceptance:** token in `@tecma/design-system-tokens` e CSS/tema Tailwind; typography allineata al Figma.

---

## DS Wave 2 — Componenti primitivi 🔵

Da implementare con flusso Figma MCP (get_design_context + get_screenshot) in `fe-followup-v3/src/components/ui/` (o dove indicato da `.cursor/rules/figma-design-system.mdc`).

| Pagina Figma | Stato |
|--------------|--------|
| Accordion 🔵 | Fatto |
| Alert 🔵 | Fatto |
| Avatar 🔵 | Fatto |
| Badge 🔴 | Presente (in codice; allineare al Figma se serve) |
| Button 🔵 | Fatto |
| Button Group 🔵 | Fatto |
| Checkbox 🔵 | Fatto |
| Divider 🔵 | Fatto |
| Dropdown 🔵 ℹ️ | Da fare |
| Input 🔵 | Fatto |
| Password Input 🔵 | Fatto |
| Phone Input 🔵 | Fatto |
| Link 🔵 | Fatto |
| Modal 🔵 ℹ️ | Fatto |
| Pagination 🔵 | Fatto |
| Progress Bar 🔵 | Fatto |
| Progress Indicator 🔵 | Fatto |
| Radio 🔵 | Fatto |
| Spinner 🔵 | Fatto |
| Tabs 🔵 | Fatto |
| Tag 🔵 | Fatto |
| Text Area 🔵 | Fatto |
| Timepicker 🔵 | Da fare |
| Toggle 🔵 | Fatto |
| Tooltip 🔵 | Fatto |

---

## DS Wave 3 — Componenti compositi e layout 🟠

| Pagina Figma | Stato |
|--------------|--------|
| Card 🔴 | Fatto |
| Carousel 🟠 | Da fare |
| Datepicker 🟠 | Da fare |
| Drawer 🟠 | Da fare |
| File Upload 🟠 | Fatto |
| Form 🟠 | Da fare |
| Grid 🔴 | Da fare |
| Header (Profile) 🟠 | Fatto |
| Menu/sidebar 🟠 | Fatto |
| Navigation 🟠 ℹ️ | Da fare |
| Select 🟠 | Presente (in codice; allineare al Figma se serve) |
| Slider 🟠 | Fatto |
| Stepper 🟠 | Fatto |
| Table 🔴 | Fatto |
| Breadcrumbs 🟠 | Da fare |
| Bottom navigation 🟠 | Da fare |
| Booking widget 🔵 | Da fare (se applicabile) |

---

## DS Wave 4 — Specializzati e miscellaneous

| Pagina Figma | Stato |
|--------------|--------|
| Inline Edit 🟠 | Da fare |
| Icons 🟠 | Da fare |
| Toast 🔴 | Fatto (Snackbar) |
| Templates 🔴 | Da fare |
| Annotations | Da fare |
| Examples | Da fare |
| Logo | Da fare |
| Cover figma | Da fare |
| Charts | Da fare |
| Illustrations | Da fare |
| Focus ring | Da fare |
| Image | Da fare |
| Slot | Da fare |
| Scrollbar | Da fare |
| Tokens | Da fare |
| Tokens 2.0 | Da fare |
| Utilities | Da fare |
| Accessibility | Da fare |

**Changelog:** riferimento documentale (nessun import codice).

---

## Regole operative

- Ogni componente si implementa seguendo le regole in `.cursor/rules/figma-design-system.mdc` (get_design_context, get_screenshot, traduzione nelle convenzioni del progetto).
- Per ogni pagina Figma il **node-id** (o l’URL con node-id) va fornito **al momento** in cui si inizia l’implementazione; non è necessario elencare tutti i link in anticipo.
- Le wave DS 2–4 sono **sub-wave** rispetto alla **Wave 2** del [FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md) (design system); non modificano la numerazione Wave 1–7.

---

## Riepilogo

| DS Wave | Contenuto | Stato |
|---------|-----------|--------|
| DS-1 | Design Tokens/Variables, Typography | Completata |
| DS-2 | Primitivi (Button, Input, …) | Parziale: 5 fatti + Badge presente |
| DS-3 | Compositi (Card, Table, Form, …) | Parziale: Select presente |
| DS-4 | Specializzati + Miscellaneous | Da fare |

---

## Guida ai prossimi passi

**Ordine consigliato** (massimo impatto con minimo sforzo):

1. **Prossimo da Figma (DS-2 primitivi)**  
   Implementare in questo ordine, fornendo l’URL della pagina Figma (con node-id) quando inizi:
   - **Checkbox** → form, filtri, preferenze.
   - **Tabs** → navigazione secondaria nelle pagine.
   - **Text Area** → già usi `TEXTAREA_LIKE_CLASSES`; componente dedicato unifica lo stile.
   - **Alert** → messaggi di errore/successo in pagina.
   - **Toggle** → impostazioni on/off.

2. **Poi (DS-3)**  
   - **Table** → unifica lo stile delle tabelle (clienti, appartamenti).  
   - **Card** → blocchi contenuto, dashboard.

3. **Quando serve**  
   - **Toast** (notifiche globali), **Datepicker**, **Pagination** → on demand quando una feature li richiede.

Per ogni componente: apri la pagina nel file Figma DS, copia l’URL (con node-id), poi chiedi: *«Implementa [Componente] da Figma»* e incolla l’URL.
