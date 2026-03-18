# Legacy Runtime Policy (Big Bang Cutover)

Obiettivo: nessun fallback legacy nei flussi runtime core.

## Stato cutover core

- `apartments.service`: query solo `tz_apartments` (fallback runtime legacy rimosso).
- `requests.service`: enrichment quote da fallback legacy rimosso.
- `unit-pricing.service`: fallback `rawPrice` rimosso (solo `sale_price` / `monthly_rent`).

## Guard CI anti-regressione

Script: `be-followup-v3/scripts/check-no-legacy-runtime.sh`

Controlli bloccanti (core runtime):

- `queryLegacyApartments(...)`
- `fetchQuoteFromLegacy(...)`
- source pricing `rawPrice`
- lettura diretta `collection("apartments")` nei servizi core target

Esecuzione locale:

```bash
cd be-followup-v3
npm run check:no-legacy-runtime
```

