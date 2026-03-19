# DR Drill Runbook

## Obiettivo
Verificare in modo ripetibile il ripristino servizio e dati entro target RPO/RTO dichiarati.

## Target operativi
- RPO: massimo 24h
- RTO: massimo 2h

## Pre-check
- Backup recente disponibile e verificato.
- Accessi operativi a DB, runtime, observability.
- Finestra di test approvata.

## Procedura drill
1. Selezionare backup snapshot di riferimento.
2. Ripristinare ambiente di recovery isolato.
3. Eseguire smoke BE (`/v1/health`) e FE (`/`).
4. Eseguire journey core:
   - login
   - query clienti
   - query appartamenti
   - cambio stato trattativa
5. Verificare integrita` dati campione (client, apartment, request, audit).
6. Validare telemetry minima (log strutturati + trace request end-to-end).
7. Registrare tempi effettivi RPO/RTO.

## Evidenze obbligatorie
- Timestamp inizio/fine drill
- backup utilizzato
- output smoke/journey
- mismatch dati trovati e risolti
- tempi RPO/RTO misurati
- azioni correttive aperte

## Exit criteria
- Tutti i journey core verdi
- Nessuna perdita dati oltre RPO
- Ripristino entro RTO
- Report drill archiviato in docs/archive/drill/<date>.md
