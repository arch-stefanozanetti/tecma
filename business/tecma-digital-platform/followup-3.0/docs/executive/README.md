# FollowUp 3.0 — Panoramica per leadership (CTO / CEO)

**Ultimo aggiornamento:** 2026-03-26  

**Nell’app:** Admin → **Panoramica strategica**, URL `/executive`, command palette. Inizia dal tab **Panoramica visiva** (mappe di dominio).

**Backlog:** [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) · **Visione prodotto:** [FOLLOWUP_3_MASTER.md](../FOLLOWUP_3_MASTER.md)

---

## Percorsi di lettura

```mermaid
journey
    title Percorsi di lettura consigliati
    section CEO_breve
      Leggi_01_executive_summary: 5: CEO
      Leggi_06_rischi_decisioni: 4: CEO
    section CTO_completo
      01_executive: 5: CTO
      02_greenfield: 4: CTO
      03_stadio_domini: 4: CTO
      04_architettura: 4: CTO
      05_privacy: 3: CTO
      06_rischi: 4: CTO
      07_migrazione_legacy: 4: CTO
```

- **~15 min (CEO):** [01](01-executive-summary.md) → [06](06-risks-open-decisions.md) (solo “In 30 secondi” + decisioni).  
- **Completo (CTO):** 01 → 02 → 03 → 04 → 05 → 06 → [07](07-legacy-migration-and-data-parity.md).

---

## Indice documenti

| Doc | Pubblico | Contenuto |
|-----|----------|-----------|
| [01](01-executive-summary.md) | CEO, board | Baseline operativa vs narrativa commerciale; cosa non promettiamo. |
| [02](02-why-greenfield-vs-legacy.md) | CEO + CTO | Perché rebuild perimetrato oggi. |
| [03](03-domain-maturity-matrix.md) | CTO | Stadio operativo per area + link tecnici. |
| [04](04-architecture-at-a-glance.md) | CTO | Stack, deploy, integrazioni. |
| [05](05-privacy-gdpr-and-tenant-model.md) | CTO, DPO | Tenant, PII, disclaimer. |
| [06](06-risks-open-decisions.md) | CEO + CTO | Rischi e decisioni aperte. |
| [07](07-legacy-migration-and-data-parity.md) | CTO, Product | Migrazione dati da Mongo legacy read-only, obiettivi A/B, metodo e deliverable. |

---

## In 30 secondi

FollowUp 3.0 è un **CRM immobiliare** su stack nuovo: su **perimetro scelto** la baseline è **in produzione controllata**, non solo prototipo. La leadership allinea **direzione**, **stadio operativo** e **rischi**; il dettaglio resta nel [piano globale](../PIANO_GLOBALE_FOLLOWUP_3.md). Go-live cliente: [RELEASE_READINESS_CHECKLIST.md](../RELEASE_READINESS_CHECKLIST.md).
