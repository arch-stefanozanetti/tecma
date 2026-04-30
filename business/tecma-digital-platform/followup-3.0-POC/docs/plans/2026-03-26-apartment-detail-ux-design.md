# Design UX — Scheda appartamento (planimetrie multiple + dati legacy)

**Data:** 2026-03-26  
**Stato:** approvato (scelta **B**)  
**Contesto:** Followup 3.0 — `fe-followup-v3` scheda unità (`/apartments/:id`)

## Decisione prodotto

**Scelta B — Layout pronto per più planimetrie/immagini**, anche prima che il backend esponga un array completo:

- La UI deve presentare un **contenitore “Galleria planimetrie”** pensato per **N immagini** (carousel o griglia responsive), non solo un singolo `<img>`.
- **Fase 1 (API attuale):** sorgente primaria = `planimetryUrl` (stringa singola) → mostrata come **prima slide** / **prima card** della galleria.
- **Slot aggiuntivi:** finché non esiste `planimetryUrls[]` (o allegati) in API, gli slot extra possono essere **vuoti** (placeholder “Nessuna planimetria aggiuntiva”) o **nascosti** con struttura DOM che accetta facilmente `map` su array in futuro.
- **Nessun duplicato visivo:** non mostrare due volte la stessa URL se in futuro primaria + array si sovrappongono — deduplicare in merge.

## Obiettivi utente

| Obiettivo | Misura di successo |
|-----------|-------------------|
| Riconoscere l’unità a colpo d’occhio | Planimetria visibile above the fold senza scroll eccessivo su desktop |
| Consultare più tavole | Navigazione chiara tra immagini (frecce / dots / swipe mobile) |
| Leggere dati legacy | Struttura tipologia/vani/piano/tag + extra non come dump di chiavi raw |

## Architettura UI (sezioni)

1. **Header** (esistente): codice, nome, azioni — invariato salvo eventuale badge “Immagini: N”.
2. **Galleria planimetrie** (nuovo blocco principale)
   - **Desktop:** area sinistra (2/3) o full-width sopra le tab; min-height coerente con card.
   - **Mobile:** stack verticale, galleria prima del riepilogo prezzo se possibile.
   - **Comportamento:** carousel (es. Radix/shadcn pattern) con `primaryUrl` = `planimetryUrl`; thumbnails opzionali sotto in fase 2.
   - **Stati:** loading skeleton, errore caricamento (link “Apri in nuova scheda”), `alt` descrittivo (`Planimetria — {unitName}`).
   - **Accessibilità:** controlli carousel focusabili; `aria-live` opzionale per indice slide.
3. **Scheda tecnica** (consolidamento)
   - Tipologia, vani, camere, bagni, piano, superficie, tag (chips), da `plan` / `floor` / `tags`.
4. **Tab Dettagli**
   - `extraInfo`: sottosezioni o label umanizzate; oggetti annidati in accordion o lista indentata (no JSON grezzo in faccia).
5. **Drawer modifica**
   - Allineamento ai blocchi sopra; campo singolo URL resta finché; preparare commento TODO o prop `additionalPlanimetryUrls?: string[]` quando l’API sarà pronta.

## Modello dati — evoluzione

| Fase | Fonte | Note |
|------|--------|------|
| Ora | `planimetryUrl: string` | Prima immagine della galleria |
| Futuro | `planimetryUrls?: string[]` o `attachments?: { url, label?, sortOrder }[]` | Merge con dedup; ordinamento esplicito |

## Acceptance criteria (release 1 con scelta B)

1. È presente un componente **Galleria** che supporta **almeno un’immagine** da `planimetryUrl` e **UI pronta per N** (carousel con più slide quando l’array sarà popolato).
2. Con un solo URL, l’utente vede **una slide** e **indicatori** (es. “1 / 1”) o UI che non suggerisce contenuti mancanti in modo aggressivo (no “Errore” se non ci sono altre slide).
3. **Fallback:** URL assente o vuoto → messaggio “Nessuna planimetria caricata” + CTA verso modifica (se permesso).
4. **Scheda tecnica** visibile in Panoramica (o subito sotto galleria) con i campi legacy disponibili.
5. **Dettagli:** `extraInfo` non mostra solo chiavi snake_case senza contesto; almeno note legacy con label chiara.

## Fuori scope (v1)

- Upload file lato browser verso storage (solo URL).
- Editing multi-upload senza backend.
- Pinch-zoom full-screen (backlog).

## Riferimenti codice attuale

- `ApartmentDetailPage.tsx` — composizione tab e drawer.
- `ApartmentDetailPanoramica.tsx` — dettaglio commerciale; integrare galleria sopra o affiancata.
- `ApartmentDetailDettagliTab.tsx` — `extraInfo` da rifinire.
- `ApartmentRow` / API — estendere quando disponibile array immagini.

## Prossimo passo implementativo

Implementare in ordine: (1) componente `ApartmentPlanimetryGallery` con props `{ primaryUrl, additionalUrls?: string[] }` (default `additionalUrls=[]`), (2) inserimento in Panoramica, (3) rifinitura Dettagli, (4) allineamento drawer.
