# Match Design System (@tecma/ds) ↔ Followup 3.0 e piano allineamento

Repo di riferimento:
- **DS (Tecma):** `fe-tecma-design-system-release` → pacchetto **@tecma/ds** (Storybook: https://ds-biz-tecma-dev1.tecmasolutions.com/)
- **Noi:** `followup-3.0/fe-followup-v3` → componenti in `src/components/ui/` (Tailwind, Radix, @tecma/design-system-tokens)

Obiettivi:
1. **Match:** tabella componente DS ↔ nostra; decidere dove usare il DS e dove tenere le nostre implementazioni.
2. **Allineare le nostre:** aggiungere in followup-v3 tutte le componenti che servono e che esistono nel DS (o da Figma).
3. **DS con test e DRY:** nel repo fe-tecma-design-system-release ogni componente deve avere test; eliminare duplicazioni (DRY).

**Mappatura per “copia e port”:** quale componente DS portare da noi e **come normalizzarlo** (Tailwind, Radix, niente MUI/SASS) è descritta in **[DS_MAPPATURA_COPIA_PORT.md](DS_MAPPATURA_COPIA_PORT.md)**.

---

## Differenza di stack

| | @tecma/ds (fe-tecma-design-system-release) | fe-followup-v3 |
|---|--------------------------------------------|----------------|
| **Styling** | SASS, @emotion, @mui/material, classnames | Tailwind, @tecma/design-system-tokens |
| **UI primitives** | MUI, custom | Radix UI (Dialog, Select, Tabs, ecc.) |
| **React** | 17 | 18 |
| **Test** | Jest, @testing-library, __tests__/*.spec.tsx | Vitest, alcuni test next-to-component |

Usare **@tecma/ds** come dipendenza in followup-v3 porterebbe MUI/Emotion/SASS nel bundle. L’alternativa è **allineare API e look** (Figma + DS come riferimento) mantenendo il nostro stack (Tailwind/Radix).

**Raccomandazione:** tenere il nostro stack in followup-v3; usare il DS come **riferimento visivo e di API** (e Storybook) e **allineare** le nostre componenti. Per componenti molto complessi (es. DatePicker, DateRangePicker, Table) si può valutare in seguito un wrapper che usa @tecma/ds solo dove conviene.

---

## Tabella di match componenti

Legenda:
- **Solo DS:** esiste solo nel DS → da aggiungere in followup (o import da DS se si decide di dipendere da @tecma/ds).
- **Solo noi:** esiste solo in followup-v3.
- **Entrambi:** confrontare API e stile; allineare il nostro al Figma/DS (test, DRY nel DS).

| Componente | DS (@tecma/ds) | Followup-v3 (ui/) | Azione |
|------------|----------------|-------------------|--------|
| Accordion | ✅ | ✅ accordion.tsx | Allineare API/stile al Figma; DS: verificare test |
| Alert | ✅ | ✅ alert.tsx | Allineare; DS: test presente |
| Avatar | ✅ | ❌ | Aggiungere in followup (da Figma/DS) |
| Badge | ❌ | ✅ badge.tsx | Solo noi; allineare al Figma se serve |
| Button | ✅ | ✅ button.tsx | Allineare; entrambi con test |
| ButtonGroup | ✅ | ✅ button-group.tsx | Allineare |
| Card | ✅ | ❌ | Aggiungere in followup (da Figma/DS) |
| Carousel | ✅ | ❌ | Aggiungere se serve; altrimenti solo DS |
| Checkbox | ✅ | ✅ checkbox.tsx | Allineare; DS: **manca spec** (c’è solo CheckboxGroup.spec) |
| DatePicker | ✅ | ❌ | Valutare: aggiungere in followup o dipendere da DS |
| DateRangePicker | ✅ | ❌ | Idem |
| Divider | ✅ | ❌ | Aggiungere (semplice, da Figma) |
| Drawer | ✅ | ✅ sheet.tsx (Radix) | Allineare nome/API se serve; DS Drawer = Sheet |
| DropDown | ✅ | ❌ (usiamo Radix in header) | Allineare dropdown “DS” se serve componente generico |
| Header | ✅ Header + TecmaHeader | ✅ app-header.tsx | Allineare API (TecmaHeader vs nostro) |
| Input | ✅ | ✅ input.tsx | Allineare |
| Link | ❌ | ✅ link.tsx | Solo noi; ok |
| Modal | ✅ | ✅ dialog.tsx + ModalHeader | Allineare size/varianti |
| Pagination | ✅ | ✅ pagination.tsx | Allineare layout (complete/intermediate/essential) |
| PhoneInput | ✅ | ✅ phone-input.tsx | Allineare |
| ProgressBar | ✅ | ✅ progress.tsx | Allineare |
| ProgressIndicator | ✅ | ❌ | Aggiungere in followup (da Figma) |
| Radio / RadioGroup | ✅ | ❌ | Aggiungere (da Figma/DS) |
| Select | ✅ | ✅ select.tsx | Allineare; DS: **manca spec** |
| Sidebar / Menu | ✅ Sidebar, TecmaSidebar, NavigationItem | ✅ sidebar-menu.tsx, app-header | Allineare (TecmaSidebar vs SidebarMenu) |
| Slider | ✅ | ❌ | Aggiungere se serve |
| Spinner | ✅ | ✅ spinner.tsx | Allineare |
| Stepper | ✅ | ❌ | Aggiungere se serve |
| Tab | ✅ | ✅ tabs.tsx | Allineare |
| Table | ✅ TableMaterial | ❌ | Aggiungere (table) o usare DS |
| Tag | ✅ | ❌ | Aggiungere (da Figma) |
| TextArea | ✅ | ✅ textarea.tsx | Allineare |
| TimePicker | ✅ | ❌ | Aggiungere se serve; DS: **manca spec** |
| Toggle | ✅ | ✅ switch.tsx | Allineare (nome Toggle vs Switch) |
| Tooltip | ✅ | ✅ tooltip.tsx | Allineare |
| Snackbar | ✅ | ❌ | Aggiungere (toast/snackbar) |
| File Upload | ❌ | ✅ file-upload.tsx | Solo noi |
| Password Input | ❌ | ✅ password-input.tsx | Solo noi |
| ScrollArea | ❌ | ✅ scroll-area.tsx | Solo noi (Radix) |
| Separator | ❌ | ✅ separator.tsx | Solo noi (Radix) |

---

## Cosa fare in followup-v3 (nostre componenti)

1. **Aggiungere le mancanti** (priorità in base a DESIGN_SYSTEM_COMPONENTS_WAVES.md):  
   Avatar, Card, Divider, ProgressIndicator, Radio/RadioGroup, Tag, Snackbar (Toast), Stepper, Slider, Table (o uso DS), DatePicker/DateRangePicker (o dipendenza DS).
2. **Allineare** le esistenti al Figma e, dove utile, all’API del DS (naming, props, varianti).
3. **Test:** estendere test (Vitest) per tutte le componenti UI, ispirandosi agli standard test del DS (performStandardTest, checkSizeProp, ecc.).

---

## Cosa fare in fe-tecma-design-system-release (DS: test + DRY)

### Test mancanti (componenti esportati senza `__tests__/*.spec.tsx`)

Aggiungere spec per:

- Checkbox
- Select
- SelectDynamic / SelectDynamicMultiple
- DatePicker (e DatePickerMobile)
- DateRangePicker
- TimePicker
- LanguageSelector
- TecmaSidebar
- TecmaSidebarMobile
- TecmaHeader
- TecmaHeaderMobile
- NavigationItem
- LoaderPage

(Altri componenti esportati hanno già spec in `__tests__/`.)

### DRY (duplicazioni da eliminare)

1. **DatePicker e DateRangePicker**  
   `DatePicker/utils/index.ts` e `DateRangePicker/utils/index.ts` contengono le stesse funzioni (`transPlacement2DropdownAlign`, `getStatusClassNames`, `getLocale`).  
   - Creare un modulo condiviso (es. `src/components/DatePickerShared/utils.ts` o `src/helpers/datePickerUtils.ts`) ed importarlo da entrambi.

2. **Altri pattern**  
   Verificare altri copy-paste tra componenti (es. stili SASS, costanti) e centralizzare in `helpers/` o `styles/`.

### Standard qualità DS

- Ogni componente esportato ha almeno un file `__tests__/ComponentName.spec.tsx`.
- Uso di `performStandardTest` (o equivalente) per snapshot/comportamento base.
- Nessuna logica duplicata tra DatePicker e DateRangePicker (e altri casi simili).

---

## Riepilogo

| Dove | Azione |
|------|--------|
| **followup-v3** | Aggiungere componenti mancanti (Avatar, Card, Divider, Tag, Radio, Stepper, Slider, Snackbar, ProgressIndicator, Table/DatePicker se serve); allineare le esistenti a Figma/DS; aumentare test Vitest. |
| **fe-tecma-design-system-release** | Aggiungere test per tutti i componenti esportati senza spec; estrarre utils condivisi DatePicker/DateRangePicker (DRY); verificare altri duplicati. |

Dopo questo allineamento, le componenti del DS saranno coperte da test e DRY; le nostre in followup-v3 saranno complete e allineate al DS/Figma, mantenendo Tailwind/Radix.
