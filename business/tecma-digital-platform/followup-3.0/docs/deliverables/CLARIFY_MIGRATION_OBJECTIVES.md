# Obiettivi di migrazione — formalizzazione per CTO / leadership

**Stato:** baseline per allineamento decisionale  
**Correlati:** [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) §6, [01-executive-summary.md](../executive/01-executive-summary.md), [07-legacy-migration-and-data-parity.md](../executive/07-legacy-migration-and-data-parity.md)

---

## Due obiettivi distinti (non confondibili)

| ID | Nome | Definizione | Criterio di successo |
|----|------|-------------|----------------------|
| **A** | **Conservazione dati** | Ogni informazione legacy ritenuta rilevante dal business ha una **destinazione** nel nuovo mondo: campo strutturato in `tz_*`, estensione documentata (`extraInfo`, metadata), o archivio versionato con riferimento alla sorgente (`legacyId`, `sourceDb`). | Inventario firmato + conteggi pre/post migrazione + report diff su campione e su pilota; nessun attributo P1/P0 “perso” senza decisione esplicita “non importare”. |
| **B** | **Parità funzionale / prodotto** | Dove il business lo richiede, **stessi flussi** (UX, report, stati, preventivi) rispetto al prodotto storico. | Roadmap per fase ([PIANO_GLOBALE](../PIANO_GLOBALE_FOLLOWUP_3.md) FASE1–7): milestone con demo e criteri di accettazione; non si confonde con l’obiettivo A. |

**Messaggio chiave:** FollowUp 3.0 **non clona lo stack monolitico** del legacy ([01](../executive/01-executive-summary.md)), ma **“non clone architetturale” ≠ “buttiamo i dati”**. L’obiettivo A riguarda **persistenza e tracciabilità**; l’obiettivo B riguarda **prodotto e roadmap**.

---

## Vincoli di tempo e priorità (da compilare con il CTO)

Usare questa tabella in riunione; le celle vuote sono decisioni aperte.

| Domanda | Risposta / nota |
|---------|------------------|
| Data target per **pilota** (un workspace / un brand)? | |
| Data target per **go-live massivo** (se previsto)? | |
| Priorità: prima **A** su tutto il perimetro, poi **B**, oppure **B** solo su cluster ad alto valore? | |
| Budget per spike **GDPR** (consensi progetto vs workspace)? | |
| Convivenza: **solo lettura legacy** fino a cutover definitivo, oppure doppia scrittura (sconsigliata salvo eccezioni documentate)? | |

---

## Collegamento operativo

- Inventario tecnico: [LEGACY_MONGO_INVENTORY.md](./LEGACY_MONGO_INVENTORY.md)  
- Matrice campi: [FASE1_CSV_MAPPING.md](./FASE1_CSV_MAPPING.md)  
- RBAC: [RBAC_LEGACY_TO_WORKSPACE_MAPPING.md](./RBAC_LEGACY_TO_WORKSPACE_MAPPING.md)  
- Stati SELL: [WORKFLOW_SELL_STATE_MAPPING.md](./WORKFLOW_SELL_STATE_MAPPING.md)  
- GDPR: [GDPR_CONSENT_SCOPE_SPIKE.md](./GDPR_CONSENT_SCOPE_SPIKE.md)  
- Pilota ETL: [PILOT_ETL_RUNBOOK.md](./PILOT_ETL_RUNBOOK.md)
