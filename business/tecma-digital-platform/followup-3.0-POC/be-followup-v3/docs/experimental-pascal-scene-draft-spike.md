# Spike: bozza scena Pascal da prompt (`ai-scene-draft`)

## Obiettivo

Valutare se un LLM può produrre un **grafo scena strutturato** (chiavi `nodes` + `rootNodeIds`) compatibile con `applySceneGraphToEditor`, evitando mesh OBJ/GLB grezze.

## Cosa è stato implementato

- Endpoint `POST /v1/experimental/pascal/ai-scene-draft` (Tecma admin, workspace con provider **OpenAI** e API key).
- `completeJson` (gpt-4o-mini, `json_object`) + validazione **Zod** minima (`id`, `type` per nodo + `passthrough` per i campi Pascal).
- Vincoli server: `maxNodes` (default 48, max 200), `allowedTypes` opzionale, `rootNodeIds` devono esistere in `nodes`.

## Fattibilità osservata

- **Stanze / volumi semplici** (pochi muri, un livello, site → building → level): realistico come **bozza** da rifinire a mano; il modello tende a rispettare il formato JSON se il system prompt è stretto.
- **Edifici completi** (molti nodi, tetti, aperture, arredi): poco realistico in un solo shot senza pipeline incrementale, tool calling o validazione geometrica lato server.

## Limiti

- Nessuna garanzia che ogni nodo soddisfi gli **Zod schema** completi di `@pascal-app/core` (wall start/end, spessori, ecc.): graph invalidi possono rompere il viewer o produrre geometrie assurde.
- Riferimenti `children` incoerenti o `id` non allineati alla chiave: parzialmente mitigato da normalizzazione `id`, ma non c’è un full graph validator.
- **Costo/latency**: una chiamata chat + JSON per richiesta; prompt lunghi e `maxNodes` alti aumentano token.
- Solo **OpenAI** in questo spike (allineato al render Pascal workspace).

## Rischi

- Regressioni UX se si applica un draft malformato (crash runtime nel viewer).
- Allucinazioni su scale/misure: serve review umana prima di usare in produzione.

## Prossimi passi suggeriti

1. Validare il draft con uno **schema Zod condiviso** (o subset esportato) dal package core, non solo `passthrough`.
2. **Dry-run** mode: validare senza applicare, elenco errori per nodo.
3. Generazione **incrementale** (es. solo muri su livello esistente) con contesto della scena corrente serializzato nel prompt.
4. Feature flag / permessi più granulari oltre Tecma admin se l’endpoint esce dallo spike.
