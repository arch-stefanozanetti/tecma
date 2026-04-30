# Product Navigation Simplification

## Objective

Ridurre la complessita' percepita della shell Followup 3.0 separando in modo netto:

- lavoro operativo quotidiano
- analisi e viste di supporto
- impostazioni e configurazione
- aree interne / Tecma-only

## Current Problems

- La sidebar mescola CRM operativo, configurazione, analytics e aree interne.
- Alcune capability tecniche (`ZEUS`, `Big Data`) sembrano prodotti a se' invece che parti di flussi piu' ampi.
- Alcune aree interne (`executive`, `COIMA`, `experimental`, `Tecma entitlements`, `Product Blueprint`) inquinano la narrativa di prodotto.
- La command palette riflette la stessa complessita' e amplifica il rumore.

## Target Information Architecture

### Primary

- Home
- Clienti
- Appartamenti
- Trattative
- Calendario
- Inbox

### Insights

- Customer 360
- Report
- Prezzi e disponibilita'

### Settings

- Progetti
- Integrazioni
- Sicurezza account
- Workflow
- Workspace
- Utenti
- Email transazionali

### Hidden From Standard Product Navigation

- ZEUS (raggiungibile come tab dentro Integrazioni)
- Big Data (raggiungibile da Integrazioni / Progetti, non top-level)
- Product Discovery
- Experimental
- Panoramica strategica
- Assessment COIMA / BTS
- Entitlement workspace
- Product Blueprint (Jira)

## Execution Phases

### Phase 1

- Semplificare sidebar desktop/mobile.
- Semplificare command palette.
- Rinominare il contenitore secondario da "Strumenti" a "Impostazioni".
- Nascondere dalla navigazione standard le aree interne o troppo tecniche.

### Phase 2

- Ripensare i titoli di pagina e le micro-descrizioni per allinearle alla nuova IA.
- Trasformare `ZEUS` e `Big Data` in tab/entry-point coerenti dentro aree piu' grandi.
- Ripulire footer e shortcut per riflettere le sezioni realmente importanti.

### Phase 3

- Aggiungere onboarding e "Come funziona" coerenti con la nuova architettura.
- Introdurre quick actions role-based nella Home.
- Introdurre help contestuale persistente per le sezioni core.

### Phase 3 Status

- `Come funziona` introdotto come pagina dedicata raggiungibile da footer e command palette.
- Onboarding guidato e help contestuale persistente ancora da implementare.

## Success Criteria

- Sidebar con massimo 6 voci operative sempre visibili.
- Nessuna area internal-only nella nav standard.
- Command palette orientata ai task, non alla struttura tecnica.
- Percezione prodotto piu' chiara gia' al primo login.
