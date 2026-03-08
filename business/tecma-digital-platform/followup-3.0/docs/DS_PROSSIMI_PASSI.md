# Design system — Cosa manca e cosa fare dopo

Riferimento: [DESIGN_SYSTEM_COMPONENTS_WAVES.md](DESIGN_SYSTEM_COMPONENTS_WAVES.md), [DS_MAPPATURA_COPIA_PORT.md](DS_MAPPATURA_COPIA_PORT.md).

---

## 1. Fatto (aggiornato)

- **Barrel export** `src/components/ui/index.ts` — tutti i componenti UI re-esportati.
- **Slider** — `slider.tsx` (input range + Tailwind, onValueChange).
- **Table** (base) — `table.tsx` (Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption).
- **Dropdown generico** — `dropdown-menu.tsx` (Radix: DropdownMenu, Trigger, Content, Item, Separator, Label, Sub, ecc.).
- **Test** — aggiunti test per: radio-group, card, tag, snackbar, stepper, divider, avatar, progress-indicator (51 test totali in ui).

---

## 2. Ancora da fare (componenti)

| Priorità | Componente | Note |
|----------|------------|------|
| **Media** | **Timepicker** | Input time nativo o select ore/minuti. Solo se in scope. |
| **Media** | **DatePicker** | Complesso; solo se serve. Valutare react-day-picker + Tailwind. |
| **Bassa** | Carousel, Grid (wrapper), Breadcrumbs, Bottom navigation | On demand. |

**Drawer:** già coperto da `sheet.tsx` (Radix Sheet).

---

## 3. Coerenza e doc

- **Storybook (opzionale):** storie per i componenti ui — richiede setup Storybook in fe-followup-v3.
- **Badge:** verificare allineamento al Figma (varianti, size).
