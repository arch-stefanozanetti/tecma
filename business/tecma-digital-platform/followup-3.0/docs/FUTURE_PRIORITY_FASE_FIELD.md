# Priorità / fase nel catalogo (post-MVP)

## Problema

L’ordine delle righe in **Product Blueprint** segue la **gerarchia Epic** (E1–E14), non la **fase di rollout** del piano globale né l’urgenza commerciale.

## Opzione futura

Aggiungere al modello catalogo un campo opzionale, ad esempio:

- `businessPriority` (numero 1…n) oppure
- `fase` (stringa allineata a `PIANO_GLOBALE_FOLLOWUP_3.md`)

Usi:

- ordinamento alternativo in UI (toggle “Ordina per Epic” / “Ordina per fase”);
- filtro per milestone.

## Prerequisiti

- Allineamento con PO su enum fasi e su un solo campo (evitare doppia fonte).
- Migrazione authoring in `feature-catalog.ts` + eventuale campo in API OpenAPI.

Nessuna implementazione obbligatoria in MVP; questo documento chiarisce l’intento del piano di prodotto.
