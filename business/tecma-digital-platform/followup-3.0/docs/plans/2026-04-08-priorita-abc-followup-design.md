# Priorità integrate A / B / C — Followup 3.0

**Data:** 2026-04-08  
**Stato:** design approvato per uso operativo (non sostituisce il piano globale)  
**Riferimenti:** [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md) · [FOLLOWUP_3_MASTER.md](../FOLLOWUP_3_MASTER.md) · [ACCEPTANCE_GATES.md](../ACCEPTANCE_GATES.md) · rischi/decisioni in [executive/06-risks-open-decisions.md](../executive/06-risks-open-decisions.md)

---

## 1. Scopo

Fornire un **unico modo di etichettare e ordinare il lavoro** usando tre lenti contemporaneamente:

| Lente | Significato | Domanda guida |
|--------|-------------|----------------|
| **A** | Allineamento a **fasi e checklist** del piano globale e deliverable FASE | È nel perimetro dichiarato e in quale FASE / ID checklist? |
| **B** | **Parità legacy** (dati, flussi, aspettative utente che migrano) | Cosa manca rispetto al comportamento o ai dati attesi dal perimetro di migrazione concordato? |
| **C** | **Valore rapido** (tipicamente 2–4 settimane): demo, riduzione attrito, feedback | Cosa massimizza valore percepito / stabilità con il minor rischio di scope creep? |

Questo documento **non** sostituisce [PIANO_GLOBALE_FOLLOWUP_3.md](../PIANO_GLOBALE_FOLLOWUP_3.md): le priorità e lo stato “ufficiale” restano aggiornati lì. Qui si definisce **come combinare** A, B e C in backlog e release senza tre roadmap separate.

---

## 2. Regole di composizione (sprint / incrementi)

1. **Ogni incremento** include almeno un’iniziativa con tag **C** (valore utente o stabilità misurabile in breve).
2. **Ogni release “contrattata”** con un cliente o perimetro di migrazione include almeno un esito misurabile con tag **B** sul **perimetro scritto** (vedi §4).
3. **A** guida la **sequenza** quando esistono dipendenze tra fasi (es. entitlement e gate commerciali prima di espandere connettori a pagamento; dati/mapping prima di promettere parità su volumi reali).

---

## 3. Matrice temi → tag → dipendenze

Legenda tag: **A** = piano/FASE, **B** = parità legacy (nel perimetro), **C** = valore rapido.

| ID piano | Tema | Tag tipici | Dipendenze principali |
|----------|------|------------|------------------------|
| `commercial-entitlements` | Entitlement Tecma, API key, connettori gated | A, B, C | RBAC stabile; policy commerciale su chi attiva cosa; audit |
| `csv-mapping` | CSV → `tz_*` + API/UI | A, B | CSV reali; regole ID progetto/workspace ([LEGACY_PROJECT_WORKSPACE_MAPPING](../deliverables/LEGACY_PROJECT_WORKSPACE_MAPPING.md)) |
| `s3-verify` | Bucket, presigned upload/download | A, B | Env AWS; checklist [FASE3_S3_VERIFICATION](../deliverables/FASE3_S3_VERIFICATION.md) |
| `digital-quote` | Trattativa → quote, PDF, magic link | A, B | Storage/asset; workflow stati; [FASE2_DIGITAL_QUOTE](../deliverables/FASE2_DIGITAL_QUOTE.md) |
| `reports-dashboards` | Report, dashboard, pattern API key | A, C | Permessi `reports.*`; modello dati report |
| `calendar-sync` | Timeline + Gmail/Outlook reali | A, B | OAuth/credenziali; event model unificato; [FASE5](../deliverables/FASE5_CALENDAR_SYNC.md) |
| `connectors-ux` | Twilio, Mailchimp/AC, dummy RE | A, C | Entitlement; segreti in env |
| `inbox-contract` | Inbox, preferenze, empty state | A, C | [FASE7_INBOX_CONTRACT](../deliverables/FASE7_INBOX_CONTRACT.md) |
| `visual-parity` | UI vs `fe-tecma-itd` | A, B | Design system; [FASE8](../deliverables/FASE8_VISUAL_PARITY.md) |
| `ux-mobile` | Checklist mobile per pagina | A, C | Layout componenti condivisi |
| `refactor-api-layer` | Facade FE / domini | A, C | Evitare regressioni: test core + E2E smoke |
| Opzionali (`matching-be`, `dialog-drawer`, …) | Affinamenti | C (o A se promossi in checklist) | Coerenza con permessi e OpenAPI |

---

## 4. Definition of Done — parità legacy (B)

La parità **non** è “uguale al legacy su tutto il prodotto” salvo decisione esplicita. Per ogni **perimetro di migrazione** (progetto, cliente, batch dati) va definito un documento breve o sezione in runbook con:

- **Ambito:** quali entità e flussi (es. clienti + trattative + calendario lettura).
- **Criteri B:** elenco verificabile (es. “stessi stati workflow SELL per casi X”, “export CSV con colonne Y”, “nessun dato PII mostrato senza consenso Z”).
- **Fuori perimetro:** cosa resta solo su Followup 3.0 o solo su legacy per un periodo.

Finché il perimetro non è scritto, il tag **B** si applica solo a **gap generici** documentati in [07-legacy-migration-and-data-parity.md](../executive/07-legacy-migration-and-data-parity.md) / deliverable migrazione.

---

## 5. Allineamento qualità e release

- Gate CI e deploy: [ACCEPTANCE_GATES.md](../ACCEPTANCE_GATES.md), workflow `followup-3.0-ci-cd.yml`.
- Verifica post-release: `scripts/post-release-verify.sh` dove applicabile.

---

## 6. Prossimi passi operativi

1. In backlog/Jira: aggiungere campo o etichette **A / B / C** (multi-select) sulle epiche/story collegate agli ID della checklist globale.
2. In ogni planning: verificare le tre regole di §2.
3. Aggiornare questo file solo se cambia il **modello di priorità** (non per ogni task).

---

*Documento di design prodotto per integrare le lenti A/B/C discusse in sessione; il dettaglio implementativo resta nei deliverable FASE e nel piano globale.*
