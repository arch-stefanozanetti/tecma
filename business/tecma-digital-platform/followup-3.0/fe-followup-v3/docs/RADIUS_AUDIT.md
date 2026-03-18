# Raggio UI (8px)

## Fonte di verità

- **`--radius-ui`** in [`src/styles.css`](../src/styles.css) (`:root`) — sovrascrive eventuali token del pacchetto `@tecma/design-system-tokens`.
- Classi utility: **`rounded-ui`**, **`rounded-t-ui`**, **`rounded-b-ui`**, **`rounded-chrome`** (nav, bottoni chrome) — tutte legate a **`var(--radius-ui)`**. In Tailwind, `borderRadius.chrome` è `var(--radius-ui)`; inoltre in `styles.css` (layer utilities, dopo Tailwind) `.rounded-chrome` è ridefinito così da vincere su CSS vecchi o su interpretazioni in **rem** (es. `1rem` ≈ 16px) legate a `--tecma-radius` nel pacchetto token.

## Dove si usa `rounded-ui`

Pannelli principali (`shadow-panel`), dropdown/select/header, command palette, auth glass-panel, cockpit card, workspaces.

## Toolbar dentro card

La prima riga (filtri / ricerca) ha **`rounded-t-ui`** così il nodo mostra esplicitamente 8px in alto in DevTools, allineato al contenitore.

## Eccezioni intenzionali

| File | Motivo |
|------|--------|
| `phone-input.tsx` | `rounded-none` / lati interni per prefisso + campo affiancati |
| `scroll-area.tsx` | `rounded-[inherit]` eredita dal contenitore |
| `rounded-full` | Pill, avatar, switch — non usare `rounded-ui` |

## Tailwind `rounded-*`

In `tailwind.config.js` la scala `borderRadius` è 8px o `var(--radius-ui)` per `chrome`; **`rounded-chrome`** in sidebar/header equivale sempre a **8px** tramite `--radius-ui`.
