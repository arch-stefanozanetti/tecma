# Arricchimento P1/P2 dopo clone minimo

## P1 (completamento funzionale core)

1. **Appartamenti**
   - normalizzare chiavi `extraInfo` piu frequenti (`spese-condominiali`, `riscaldamento`, `classe-energetica`, `esposizione`, `disponibilita`)
   - mantenere `legacyPayload` per chiavi long-tail non ancora in UI
2. **Clienti**
   - promuovere campi `coniuge`, `family`, `additionalInfo` nelle viste dove servono
   - policy visibilita per consensi (`trattamento/profilazione/marketing`)
3. **Stati trattative**
   - mapping definitivo legacy -> macchina stati (`INIT`, `ok`, `cancellato`, `EXPIRED*`, ...)
   - side-effect su quote e lock appartamenti

## P2 (reporting e analytics)

1. **Quote annidate**
   - porting graduale di `customQuote.expenses`, `promos`, `payments`, `importantInfo`
2. **Documenti cliente**
   - migrazione `client.client_documents` verso `tz_client_documents` (o modello equivalente)
3. **Report**
   - allineamento metriche legacy con dashboard nuove (FASE4)
   - report di riconciliazione per progetto/workspace (confronto legacy vs `tz_*`)

## KPI suggeriti

- Completezza P1 per progetto: `% clienti con campi core`, `% appartamenti con extraInfo normalizzato`, `% requests con stato valido`
- Delta report: differenza max ammessa legacy vs new su metriche chiave (< 2% su pilot)
