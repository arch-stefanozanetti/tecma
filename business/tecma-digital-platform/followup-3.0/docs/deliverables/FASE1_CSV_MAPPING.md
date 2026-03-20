# Fase 1 — Mapping CSV legacy (data_first)

**Stato:** template operativo — da compilare quando sono disponibili i file CSV/export.

## Input richiesti

- [ ] CSV o export **clienti** (campione + dizionario colonne)
- [ ] CSV o export **appartamenti**
- [ ] CSV o export **quote** / preventivi legacy (standard/custom)

## Processo

1. Per ogni sorgente: elencare colonne → tipo → obbligatorietà legacy.
2. Mappare su: campo attuale API/Mongo Followup 3, campo `tz_*` additivo, o “solo display / non importare”.
3. Definire ordine di implementazione: API prima o import batch.

## Tabelle (da duplicare per file)

### Cliente

| Colonna CSV | Tipo | Note legacy | Destinazione Followup 3 | Priorità import |
|-------------|------|-------------|-------------------------|-----------------|
| _esempio_ | | | | |

### Appartamento

| Colonna CSV | Tipo | Note legacy | Destinazione Followup 3 | Priorità import |
|-------------|------|-------------|-------------------------|-----------------|
| | | | | |

### Quote

| Colonna CSV | Tipo | Note legacy | Snapshot `tz_quotes` / API | Priorità |
|-------------|------|-------------|----------------------------|----------|
| | | | | |

## Output atteso

Una volta compilato: MR che aggiorna questo file + eventuale script di import e test su campione anonimizzato.
