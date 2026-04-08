# Followup 3.0 — roadmap su più cicli (implementazione)

**Scopo:** eseguire “tutto” il perimetro [PIANO_GLOBALE_FOLLOWUP_3.md](../docs/PIANO_GLOBALE_FOLLOWUP_3.md) in **incrementi mergeabili**, uno dopo l’altro o con tracce parallele dove indicato.  
**Tracker stato:** [IMPLEMENTATION_TRACKER.md](./IMPLEMENTATION_TRACKER.md) (aggiornare `[x]`/`[~]` a chiusura ciclo).  
**Nota:** un “ciclo” = tipicamente 1–3 settimane di lavoro + PR; durata reale dipende dal team.

---

## Principi

1. **Ogni ciclo** termina con codice in `main`, CI verde, deploy Render coerente con path filter followup.
2. **Dipendenze esplicite:** non iniziare `digital-quote` senza bucket/flow S3 operativi ([FASE2_DIGITAL_QUOTE](../docs/deliverables/FASE2_DIGITAL_QUOTE.md) cita Fase 3 S3).
3. **Traccia dati (CSV)** può procedere in **parallelo** al ciclo S3/quote se i CSV arrivano tardi — non bloccare tutto il prodotto.
4. **Refactor API layer** (`refactor-api-layer`): meglio **slice verticali** dentro ogni ciclo che tocca il FE, non un “big bang” finale.

---

## Panorama cicli (ordine consigliato)

| Ciclo | Focus | ID tracker principali | Dipendenze |
|-------|--------|------------------------|------------|
| **1** | Chiusura entitlements + messaggistica commerciale + audit attivazioni (slice FASE02) | `commercial-entitlements`, `tecma-activation-audit` | — |
| **2** | Storage S3 end-to-end (presigned, checklist FASE3) | `s3-verify` | Env AWS, bucket |
| **3** | Modello quote + mapping dati ([FASE1_CSV_MAPPING](../docs/deliverables/FASE1_CSV_MAPPING.md)) dove CSV disponibili; altrimenti schema/API quote senza ETL completo | `csv-mapping` (parziale) | Opzionale parallelismo con ciclo 2 |
| **4** | Preventivo digitale: token, pubblico, PDF, magic link | `digital-quote` | Ciclo 2 (+ allineamento modello da ciclo 3) |
| **5** | Report e dashboard condivisibili (estensione oltre UI base) | `reports-dashboards` | Permessi report stabili |
| **6** | Calendario: sync reale Gmail/Outlook oltre UI | `calendar-sync` | OAuth / segreti, modello eventi |
| **7** | Connettori UX dedicati (FASE6) | `connectors-ux` | Entitlement (ciclo 1) |
| **8** | Inbox: contratto, preferenze, empty state | `inbox-contract` | — |
| **9** | Parità visiva ITD + checklist mobile | `visual-parity`, `ux-mobile` | Design system / token |
| **10** | Affinamenti UX trasversali | `dialog-drawer`, `ux-liste-card-toggle` | Basso rischio, possibile spalmare nei cicli 1–9 |
| **∞** | Refactor facade / domini FE | `refactor-api-layer` | Continuo a piccoli PR |

---

## Definition of Done per ciclo (generico)

- [ ] Criteri del deliverable FASE collegato soddisfatti o ridotti a “follow-up” esplicito nel tracker.
- [ ] Test BE/FE pertinenti aggiornati; nessuna regressione su journey E2E smoke se toccano aree coperte.
- [ ] `IMPLEMENTATION_TRACKER.md`: righe aggiornate; per cicli 2–4 verificare anche checklist in `docs/deliverables/` dove presente.

---

## Esecuzione pratica

1. Scegliere il **numero di ciclo** corrente (tabella sopra).
2. Implementare nel branch; aprire PR piccola se possibile.
3. A merge: aggiornare tracker, eventuale nota in `tasks/lessons.md` se emerge un pattern.

---

*Documento operativo: ordina il lavoro su più cicli senza pretendere un singolo mega-merge.*
