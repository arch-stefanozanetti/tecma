# Design System Panels

## Regola Obbligatoria

- `Drawer` = low-level primitive.
- `Sheet` = low-level primitive.
- `SidePanel` = primitive applicativa standard.
- In feature code usare sempre `SidePanel`.

## Matrice d'uso

| Scenario | Variant SidePanel | Primitive interna | Esempi |
|---|---|---|---|
| Form, edit, creazione, action confermative | `operational` | `Drawer` | Calendar event form, Product Discovery create/edit, pannelli filtro persistenti |
| Lettura contestuale non-editing | `preview` | `Sheet` | Inbox notifiche, pannelli read-only di consultazione |
| Navigazione/utility laterale | `navigation` | `Sheet` | Menu contestuali, quick-nav, utility panel |

## Struttura obbligatoria

Ogni `SidePanelContent` deve usare questa composizione:

1. `SidePanelHeader`
2. `SidePanelBody`
3. `SidePanelFooter`

Note:
- `SidePanelFooter` è obbligatorio anche per pannelli di sola lettura (almeno azione `Chiudi`).
- `SidePanelClose` va passato in `actions` dentro `SidePanelHeader`.

## Size standard

- `sm`
- `md`
- `lg`
- `xl`
- `full`

Le feature non devono usare width custom inline sul contenitore principale del pannello.

## Anti-pattern vietati

- Import diretto `@radix-ui/react-dialog` fuori `src/components/ui`.
- Uso di `Sheet` diretto nelle feature classificate `operational`.
- Uso di `Drawer` diretto nelle feature classificate `preview/navigation`.
- Pannelli custom con overlay/content locali fuori DS.
- Nuove classi duplicate per header/body/footer quando esistono gli slot `SidePanel*`.

## Aree classificate in questa wave

- `CalendarPage`: `operational`
- `CalendarEventFormDrawer`: `operational`
- `ProductDiscoveryPage`: `operational`
- `Inbox`: `preview`

## Enforcement CI

- Comando bloccante: `pnpm run check:panels`
- Workflow FE: check eseguito prima di lint/build/test
- Guard testato con fixture positive/negative (`pnpm run test:panels`)
