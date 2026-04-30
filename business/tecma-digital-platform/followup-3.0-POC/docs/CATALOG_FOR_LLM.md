# Uso del catalogo funzionalità Followup 3.0 con LLM

## Dove sta la “verità”

| Fonte | Contenuto |
|-------|-----------|
| `be-followup-v3/src/core/jira-prd/feature-catalog.ts` | Catalogo authoring; `FEATURE_CATALOG` esposto via API (`GET /api/v1/jira-prd/feature-catalog`) |
| `id-tema-epic-map.ts` | Mappa `idTema` → Epic Jira |
| `docs/COVERAGE_MATRIX_FOLLOWUP_3.md` | Allineamento PRD / tracker / gap codice |
| `docs/IMPLEMENTATION_TRACKER_FOLLOWUP_3.md` | Stato implementazione (non sostituisce il catalogo) |

Regole di stile per il campo `summary` in authoring: [CATALOG_SUMMARY_EDITORIAL_RULES.md](CATALOG_SUMMARY_EDITORIAL_RULES.md).

## Campi utili per prompt (tipo `JiraPrdFeatureCatalogEntry`)

- `idTema`: chiave stabile della capability.
- `areaPrefix`, `title`, `summary`: Panoramica in UI.
- `kind`: `product` | `technical` — righe `technical` hanno PRD più corto (override).
- `disciplines`: `{ frontend, backend, database, uxUi, qa, test }` — testo operativo per area.
- `epicMeta`: `epicId`, `epicKey`, `epicSummary` — tracciabilità Jira.
- `designRefs`: riferimenti design (Figma, ecc.) se presenti.
- `docLinks`: link a markdown in `docs/`.

## Prompt suggeriti

**Elenco capability per Epic**

> Dal JSON del catalogo, elenca tutte le righe con `epicMeta.epicKey === "TECMA-XXX"` e per ciascuna restituisci `idTema`, `title`, `summary` e un bullet sintetico dalla discipline `frontend` o `backend`.

**Gap implementazione**

> Incrocia `idTema` dal catalogo con le sezioni del tracker; segnala mismatch solo dove il tracker indica stato diverso da “done” per la stessa area.

## Export per embedding

- Stesso payload dell’API: `GET /api/v1/jira-prd/feature-catalog` (autenticato come le altre route followup).
- Opzionale: rigenerare `docs/CAPABILITY_INDEX_FOLLOWUP_3.md` con `yarn docs:capability-index` da `be-followup-v3` (tabella leggibile).

## Indice leggibile

Vedi [`CAPABILITY_INDEX_FOLLOWUP_3.md`](CAPABILITY_INDEX_FOLLOWUP_3.md) (generato; non editare a mano).
