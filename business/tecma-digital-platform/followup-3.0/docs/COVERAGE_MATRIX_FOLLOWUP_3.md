# Followup 3.0 — Matrice di copertura funzionale (definizione “100%”)

**Versione:** 1.0  
**Scopo:** documentare il **criterio operativo** per affermare che il [catalogo PRD](../be-followup-v3/src/core/jira-prd/feature-catalog.ts) copre l’intero perimetro Followup 3.0 rispetto a piano e codice, e come mantenerlo nel tempo.

**Non sostituisce** [IMPLEMENTATION_TRACKER.md](../tasks/IMPLEMENTATION_TRACKER.md) né [JIRA_TRACEABILITY_FOLLOWUP_3.md](./JIRA_TRACEABILITY_FOLLOWUP_3.md); li incrocia.

---

## 1. Doppia fonte di verità (fase 0)

| Fonte | Cosa verifica | Owner tipico |
|-------|----------------|--------------|
| **A — Checklist di prodotto** | [PIANO_GLOBALE_FOLLOWUP_3.md](./PIANO_GLOBALE_FOLLOWUP_3.md) §2, [IMPLEMENTATION_TRACKER.md](../tasks/IMPLEMENTATION_TRACKER.md), inventario §3 [JIRA_TRACEABILITY](./JIRA_TRACEABILITY_FOLLOWUP_3.md) | PO / PM |
| **B — Inventario tecnico** | Route/API `be-followup-v3`, pagine e API client `fe-followup-v3`, collezioni `tz_*` effettivamente usate | Tech lead |

**Regola di chiusura**

- Ogni voce in **A** deve comparire come almeno un `idTema` nel catalogo (o essere esplicitamente **assorbita** da un `idTema` più ampio con nota in §3 sotto).
- Ogni macro-area in **B** non coperta da alcun `idTema` va **aggiunta al catalogo** oppure **esclusa** con motivazione (fuori POC, deprecato, solo infra).

---

## 2. Matrice sintetica checklist → catalogo (fonte A)

Gli ID tema della checklist globale del tracker sono mappati 1:1 o N:1 verso righe catalogo `product`:

| ID checklist | Copertura catalogo |
|--------------|-------------------|
| `close-phase0` | `close-phase0` + righe dominio collegate (workspace, assignments, cockpit) |
| `user-access-granularity` | `user-access-granularity` |
| `commercial-entitlements` | `commercial-entitlements` |
| `connectors-showcase-ux` | assorbito in `integrations-hub` / `connectors-ux` (nota PO) |
| `tecma-activation-audit` | `tecma-activation-audit` |
| `csv-mapping` | `csv-mapping` |
| `s3-verify` | `s3-verify` |
| `digital-quote` | `digital-quote` |
| `reports-dashboards` | `reports-dashboards` |
| `calendar-sync` | `calendar-sync` |
| `connectors-ux` | `connectors-ux` |
| `inbox-contract` | `inbox-contract` |
| `visual-parity` | `visual-parity` |
| `ux-mobile` | `ux-mobile` |
| `refactor-api-layer` | `refactor-api-layer` |
| `matching-be` | `matching-be` + `close-phase0-technical-matching-api` |
| `dialog-drawer` | `dialog-drawer-ux` |
| `ux-liste-card-toggle` | `ux-liste-card-toggle` |

Il catalogo **esteso** aggiunge capability di dominio (auth, clienti, richieste, …) oltre la checklist: la mappa **Epic ↔ `idTema`** è la fonte unica in [epic-registry / id-tema-epic-map](../be-followup-v3/src/core/jira-prd/id-tema-epic-map.ts) e in §5.1 di [JIRA_TRACEABILITY](./JIRA_TRACEABILITY_FOLLOWUP_3.md).

---

## 3. Gap e azioni (fonte B — da aggiornare a sprint)

| Tipo gap | Azione |
|----------|--------|
| Nuova route pubblicata senza `idTema` | Aggiungere riga catalogo o estendere summary di una riga esistente + aggiornare mappa Epic |
| `idTema` obsoleto | Deprecare in catalogo (summary) o rimuovere con PR dedicata + sync tracker |
| Nuova Epic Jira TECMA | Estendere `EpicId` e tabella Epic in JIRA_TRACEABILITY |

### 3.1 Stato audit fonte B (inventario tecnico)

| Stato | Significato |
|-------|-------------|
| Non avviato | Nessun passaggio sistematico su route FE / route BE / collezioni vs catalogo |
| In corso | Elenco gap in costruzione (tabella §3.2) |
| Chiuso (data) | Ogni area in B mappata o esclusa con nota; firmato PO/tech lead |

**Procedura suggerita (per sprint)**

1. Estrarre elenco route `be-followup-v3/src/routes` (e mount in `v1.ts`) e pagine/route FE principali (`fe-followup-v3`).
2. Per ogni macro-flusso, chiedersi: esiste un `idTema` che lo copre? Se no → riga in §3.2 o nuova voce catalogo.
3. Opzionale: elenco `tz_*` da `listCollections` / modelli usati; incrociare con discipline `database` nel catalogo.

### 3.2 Registro gap (template)

| Data | Area codice (path o feature) | Coperto da `idTema` | Decisione | Owner |
|------|------------------------------|---------------------|-----------|-------|
| _esempio_ | `GET /v1/...` | `close-phase0` | OK | — |
| | | | | |

*Template riga informale da review:*

- Data:  
- Gap rilevato:  
- Decisione: aggiunta catalogo / assorbito / fuori scope  
- Riferimento PR:

---

## 4. Manutenzione

1. Ogni modifica al catalogo deve passare `assertCatalogIntegrity` e test Epic (vedi `catalog-integrity.test.ts`).
2. Allineare questo file quando cambia la definizione di perimetro POC o la checklist tracker.
3. La **mappatura Epic** è single source nel codice (`id-tema-epic-map.ts`); la tabella estesa in JIRA_TRACEABILITY deve restare coerente (copy o link).
