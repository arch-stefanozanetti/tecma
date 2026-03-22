# Design — Validazione visiva shell “tipo OS” prima della suite test

**Data:** 2026-03-22  
**Contesto:** `fe-followup-v3`, pilot **Clienti** (`DesktopSplitStage` + inspector a destra), piano correlato `2026-03-22-macos-shell-inspector-layout.md`.

## Problema

Eseguire subito l’intera suite test (`pnpm test:run`) non dà feedback su gerarchia visiva, proporzioni lista/inspector e sensazione “da desktop”. Senza un giro guidato in dev, il rischio è iterare a vuoto su assertion invece che su layout.

## Obiettivo

Avere un **percorso ripetibile** (documentato) per vedere l’app come dovrebbe comportarsi in stile OS **prima** di considerare “chiuso” il lavoro con i test automatici.

## Approcci valutati

| Approccio | Pro | Contro |
|-----------|-----|--------|
| **A — App reale (`pnpm dev`)** | Stesso chrome (sidebar, top bar), dati veri, zero codice extra | Richiede login/API/env funzionanti |
| **B — Pagina dev isolata con mock** | Nessuna dipendenza da backend; iterazione rapida su pixel | Codice da mantenere o rimuovere; rischio drift rispetto alla pagina reale |
| **C — Playwright headed / screenshot** | Ripetibilità e baseline visiva | Setup più pesante; va dopo aver capito cosa guardare a mano |

## Raccomandazione

1. **Sempre A** come gate principale: se l’ambiente è disponibile, `/clients` è la fonte di verità.  
2. **B solo on-demand** se login o API bloccano per giorni — allora uno spike minimo (route dietro flag `import.meta.env.DEV`) con 2–3 righe tabella mock.  
3. **C** opzionale dopo che la checklist manuale è stabile (es. `test:visual` o screenshot manuale in Confluence).

## Criteri di successo (checklist visiva)

Su **desktop** (larghezza ≥ breakpoint `md` del layout, coerente con `useIsMobile` / Tailwind usati in `ClientsPage`):

- Lista clienti occupa l’area principale con scroll corretto (`min-h-0` / flex).  
- Con una riga selezionata, l’**inspector** è visibile a destra con bordo separatore leggibile.  
- CTA “Apri scheda” nell’inspector e “Apri scheda completa” sulla riga sono distinguibili e non si sovrappongono semanticamente.  
- Passaggio a **mobile** (finestra stretta): niente colonna inspector “fantasma”; sheet o flusso mobile resta usabile.

## Approvazione

Design accettato implicitamente dalla richiesta di **preview prima dei test**; questo file fissa trade-off e ordine di lavoro per il team e per gli agenti che eseguono i piani.
