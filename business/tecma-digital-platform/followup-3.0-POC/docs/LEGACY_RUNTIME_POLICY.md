# Legacy Runtime Policy (Big Bang Cutover)

Obiettivo: nessun fallback legacy nei flussi runtime core.

## Stato cutover core

- `apartments.service`: query solo `tz_apartments` (fallback runtime legacy rimosso).
- `requests.service`: enrichment quote da fallback legacy rimosso.
- `unit-pricing.service`: fallback `rawPrice` rimosso (solo `sale_price` / `monthly_rent`).
- `workflow.service`: rimosso fallback `automata_configurations` (solo `tz_workflow_configs` + default in-process).
- `calendar.service`: rimosso fallback `calendars` legacy (solo `calendar_events`).

## Guard CI anti-regressione

Script: `be-followup-v3/scripts/check-no-legacy-runtime.sh`

Controlli bloccanti (core runtime):

- `queryLegacy*` helper nei path runtime core
- `fetchQuoteFromLegacy(...)`
- riferimenti runtime `automata_configurations` / `status-automata`
- lettura runtime `collection("calendars")`, `apartments_view`, `getDbByName("asset")`
- source pricing `rawPrice`
- lettura diretta `collection("apartments")` nei servizi core

Esecuzione locale:

```bash
cd be-followup-v3
npm run check:no-legacy-runtime
```
