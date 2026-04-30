# Mappatura fe-tecma-design-system-release → followup-v3 (copia e port)

Obiettivo: sapere **cosa portare** dal DS al nostro progetto e **come normalizzarlo** al nostro stack, senza mescolare i due mondi (niente Frankenstein).

---

## Regole di normalizzazione (sempre)

Quando si porta qualcosa dal DS a followup-v3:

| Dal DS | Da noi (sostituire con) |
|--------|--------------------------|
| `classnames` / `classNames(...)` | `cn()` da `src/lib/utils` |
| File `.scss` / `import '...styles/xxx.scss'` | Classi **Tailwind** (tema da `tailwind.config.js` e `@tecma/design-system-tokens`) |
| `@mui/material` (Button, Snackbar, ecc.) | **Radix** se esiste (es. Dialog, Select) oppure componente custom con Tailwind |
| `@emotion` | Tailwind + eventuale `className` |
| `DefaultProps` / `defaultProps` | Props con default in destructuring o parametri di funzione |
| `data-testid: 'tecma-xxx'` | `data-testid` uguale o nostro naming (es. `data-testid="card"`) |
| `Icon` + `IconName` (enum/string del DS) | **lucide-react**: passare il nodo React (es. `<ChevronDown />`) come prop `icon` o usare nome string → mappa a componente lucide se serve |
| `SizeStandard` / `SizeExtended` | I nostri type (es. `ButtonSize`, o union `'sm' \| 'md' \| 'lg'`) coerenti con il tema |
| Sottocartelle per componente (es. `Card/Card.tsx`, `Card/CardHeader.tsx`) | Un file per componente in `ui/`: `card.tsx` (export Card, CardHeader, CardContent… da stesso file o barrel) |
| Naming `tecma-*` in className | Evitare prefisso; usare solo classi Tailwind/semantiche del nostro tema |

**Convenzioni nostro codice:**
- Componenti in `src/components/ui/nome.tsx`, export named.
- Props: `React.ComponentPropsWithoutRef<>` + estensioni; `className?: string` sempre.
- Stile: solo Tailwind; token da `@tecma/design-system-tokens` via tema (colori, radius, font).

---

## Mappatura componente per componente

Legenda:
- **Nostro file:** il file in `fe-followup-v3/src/components/ui/` che corrisponde (o che andrà esteso).
- **Cosa copiare:** logica/API/varianti da prendere dal DS (non il codice tal quale).
- **Normalizzazione:** come adattare al nostro stack.

---

### Componenti che abbiamo già (allineare, non copiare tal quale)

| DS (fe-tecma-design-system-release) | Nostro file | Cosa prendere dal DS | Normalizzazione |
|-------------------------------------|-------------|----------------------|------------------|
| **Accordion** | `accordion.tsx` | Varianti, API (single/multiple), comportamento | Mantenere Radix; allineare props e stile Tailwind al Figma |
| **Alert** | `alert.tsx` | Varianti type (success, error, warning, info), struttura title/description | Solo Tailwind; niente SASS/Emotion |
| **Button** | `button.tsx` | Varianti (color, size), icon before/after, loading | Già cva(); allineare varianti al Figma/DS |
| **ButtonGroup** | `button-group.tsx` | Orientamento, attaccati | Tailwind |
| **Checkbox** | `checkbox.tsx` | Size, indeterminate, label placement | Radix + Tailwind |
| **Drawer** | `sheet.tsx` | Side, dimensioni | Mantenere Radix Sheet; allineare API (side, size) |
| **Input** | `input.tsx` | Stati (error, disabled), size, tipi | Tailwind; già allineato |
| **Modal** | `dialog.tsx` | Size (small/medium/large), ModalHeader (title, subtitle) | Già size + ModalHeader; verificare match Figma |
| **Pagination** | `pagination.tsx` | Layout complete/intermediate/essential, ellissi | Già fatto; confrontare con DS per edge case |
| **PhoneInput** | `phone-input.tsx` | Country selector, formato, validazione | Logica/API; stile Tailwind, niente SASS |
| **ProgressBar** | `progress.tsx` | value, showLabel | Già fatto; allineare a DS se manca qualcosa |
| **Select** | `select.tsx` | Option groups, multi, placeholder | Radix Select; allineare API |
| **Spinner** | `spinner.tsx` | Size, varianti | Tailwind |
| **Tab** | `tabs.tsx` | Orientamento, varianti | Radix Tabs; Tailwind |
| **TextArea** | `textarea.tsx` | Rows, resize, error | Tailwind |
| **Toggle** | `switch.tsx` | Size, disabled | Radix Switch; nome può restare Switch |
| **Tooltip** | `tooltip.tsx` | Placement, delay | Radix Tooltip; Tailwind |

---

### Sidebar / Header (equivalenza logica)

| DS | Nostro file | Cosa prendere | Normalizzazione |
|----|-------------|---------------|------------------|
| **TecmaSidebar** + **NavigationItem** + **Sidebar** | `sidebar-menu.tsx` (SidebarMenu, SidebarMenuItem, SidebarSubmenu) | Struttura espanso/collapsed, footer, logo slot | Già implementato; confrontare API (collapsed, onCollapsedChange, footer) |
| **TecmaHeader** / **Header** | `app-header.tsx` | Sezioni dropdown (Account, link, logout), leftContent | Già Radix DropdownMenu; allineare sezioni e stile |

---

### Da portare (non abbiamo il componente)

Per questi **non** si copia-incolla il TSX del DS: si usa il DS (e Figma) come **riferimento di API e comportamento**, e si implementa da zero con il nostro stack.

| DS | Nostro file (da creare) | Cosa copiare (solo idea/API) | Normalizzazione |
|----|--------------------------|------------------------------|------------------|
| **Avatar** | `avatar.tsx` | Props: size, src, alt, text (iniziali), icon. Comportamento: img > icon > text | Tailwind (rounded-full, size); per img usare `<img>` o Next/Image se presente; icon = ReactNode (lucide); niente LazyImage/Icon del DS |
| **Card** | `card.tsx` | API: Card, Card.Header, Card.Footer, Card.Content, Card.Media, Card.Table, Card.Container. Props: fluid, orientation, selected, setSelected, borderLess | Un file con sottocomponenti; tutto Tailwind; niente SASS |
| **Divider** | `divider.tsx` | Solo type: horizontal \| vertical | `<div>` con classi Tailwind (border-t o border-l, my- o mx-); optional `orientation` |
| **Tag** | `tag.tsx` | label, dismissable, onDismiss, icon, onClick, disabled | Un solo componente; icon come ReactNode; dismiss = Button icon ghost small; Tailwind |
| **ProgressIndicator** | `progress-indicator.tsx` | steps, currentStep, valueProgressBar (per step corrente), valueToShow (label "1/3") | Comporre il nostro `Progress` (progress.tsx); riga di N barre; Tailwind |
| **Radio** / **RadioGroup** | `radio-group.tsx` | RadioGroup + Radio, value/onChange, disabled, orientation | Radix RadioGroup; stile Tailwind |
| **Snackbar** | `snackbar.tsx` o `toast.tsx` | open, onClose, title, description, type (AlertType), anchorOrigin, autoHideDuration, actions | **Non** usare MUI: usare Radix (se c’è toast) o portal + posizione fixed; contenuto = nostro Alert; Tailwind |
| **Stepper** | `stepper.tsx` | Steps (label/optional), current step, orientazione | Componente presentazionale; numeri + connessioni; Tailwind |
| **Slider** | `slider.tsx` | min, max, value, onChange, step, disabled | Radix Slider se in package; altrimenti input range + Tailwind |
| **Carousel** | `carousel.tsx` | Solo se serve: slide, nav, dots | Valutare se serve; in caso Radix o custom con Tailwind |
| **DatePicker** / **DateRangePicker** | (opzionale) | API (value, onChange, locale, min/max) | Complesso: valutare se usare libreria (react-day-picker) + Tailwind; **non** portare rc-picker/MUI del DS |
| **TableMaterial** | `table.tsx` | Solo se serve: struttura Table, Thead, Tbody, Tr, Td, Th | Tabella semantica HTML + Tailwind; **non** MUI Table |
| **Grid** | (opzionale) | Grid + GridColumn, span | Possiamo usare Tailwind grid; componente wrapper solo se vogliamo API uguale al DS |
| **Popover** | (se serve) | trigger + content, placement | Radix Popover; già abbiamo pattern in dropdown |
| **DropDown** (generico) | (se serve) | Menu a tendina generico (trigger + items) | Radix DropdownMenu; già usato in header |
| **LanguageSelector** | Solo se serve in followup | - | Molto specifico; portare solo se richiesto |
| **SearchBar** | Solo se serve | - | Input + icon + clear; Tailwind |
| **TimePicker** | Solo se serve | - | Input time o select; Tailwind |
| **SelectDynamic** / **SelectDynamicMultiple** | Solo se serve | - | Logica async; nostro Select + load options |
| **MissingPage** / **ErrorPage** / **LoaderPage** | (in `core/` o `components/`) | Layout e messaggi | Pagine full; Tailwind |
| **LazyImage** | Solo se serve | - | IntersectionObserver o img loading="lazy"; niente codice DS |
| **ValuePicker** | Solo se serve | - | API specifica; riimplementare con nostri componenti |
| **Icon** (DS) | Non portare | - | Noi usiamo lucide-react; non introdurre IconName/enum del DS |
| **FloatingContent** / **Portal** | - | - | Radix ha Portal; non serve portare |

---

### Solo noi (non c’è nel DS)

Non toccare; restano come sono:
- `link.tsx`
- `badge.tsx`
- `file-upload.tsx`
- `password-input.tsx`
- `scroll-area.tsx`
- `separator.tsx`
- `filters-drawer.tsx` (specifico app)

---

## Ordine consigliato per “portare”

1. **Divider** – minimo, utile ovunque.  
2. **Avatar** – molto usato (header, liste).  
3. **Tag** – filtri, selezione multipla.  
4. **Card** – blocchi contenuto, liste.  
5. **RadioGroup** – form.  
6. **ProgressIndicator** – wizard/stepper.  
7. **Snackbar/Toast** – notifiche (senza MUI).  
8. **Stepper** – flussi multi-step.  
9. **Slider** – se serve.  
10. **Table** – solo se serve (tabella dati).  
11. **DatePicker/DateRangePicker** – solo se necessario (alta complessità).

---

## Riepilogo

- **Non** importare @tecma/ds in followup-v3 per i componenti UI: eviti MUI/Emotion/SASS nel nostro bundle.
- **Usa** fe-tecma-design-system-release (e Figma) come **riferimento di API e comportamento**.
- **Implementa** sempre con **nostro stack**: Tailwind, Radix dove c’è, `cn()`, token, lucide-react.
- **Niente** classnames, SASS, MUI, Icon/IconName del DS: tutto va **normalizzato** secondo la tabella sopra.

Così ciò che “copi e porti” è solo **idea, API e varianti**; il codice resta unico e coerente nel nostro progetto.
