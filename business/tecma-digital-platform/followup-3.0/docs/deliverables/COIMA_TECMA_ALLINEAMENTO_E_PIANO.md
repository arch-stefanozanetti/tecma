# Allineamento COIMA ↔ Tecma e piano operativo

**Documento unico** per discussione con COIMA e per coordinamento interno Tecma.  
**Versione:** 1.0 · **Data:** 2026-04-08  
**Fonti:** gap assessment `COIMA_BTS_TECMA_GAP_ASSESSMENT.md`, contesto progetto (mixed-use / BTS), roadmap `PIANO_GLOBALE_FOLLOWUP_3.md` e deliverable FASE2–FASE7.

---

## Come usare questo file (A / B / C / D)

| Opzione | Contenuto | Dove leggerlo |
|--------|-----------|----------------|
| **A) Presentazione / allineamento con COIMA** | Cosa possiamo promettere con realismo, cosa resta fuori dal prodotto, prossimi passi concreti | **Parte I** (sezioni 1–4) |
| **B) Piano interno Tecma** | Priorità prodotto, roadmap ricavata dal gap, ownership | **Parte II** (sezioni 5–7) |
| **C) Entrambe — due letture nello stesso documento** | Stesso file: **slide / narrativa cliente** = Parte I + riquadri “Messaggio COIMA”; **allegato tecnico interno** = Parte II + allegati numerici. In riunione: solo Parte I; in backlog / PM: Parte I + II. | Struttura sotto; sommario in **§0** |
| **D) Altro** | Aggiornamento a **ciclo commerciale** (es. post-workshop o trimestrale): rieseguire confronto requisiti vs release, revisione priorità §5 e checklist §4.3. | Processo continuo, non sezione aggiuntiva |

**§0 — Sommario esecutivo (una pagina)**

- **Contesto:** progetto mixed-use in contesto sicuro; focus **build-to-sell** — l’analisi segue il ciclo vendita / cliente BTS.
- **Numeri (da gap assessment, 70 requisiti mappati):** copertura **Sì** ~14% · **Parziale** ~51% · **No** ~34%. I “No” sono **confini di prodotto / integrazione**, non elenco di “mancanze casuali”.
- **Per COIMA:** Parte I definisce messaggio e passi; **Parte II** resta per Tecma (trasparente se COIMA chiede “come fate roadmap” — si può condividere in estratto).

---

## Parte I — Allineamento con COIMA

### 1. Contesto e perimetro

- Il documento requisiti COIMA descrive una catena **Prospect → Preliminare → Vita fino a consegna → Post consegna**.
- **Perimetro di questo allineamento:** canale **build-to-sell** e ciclo cliente **vendita**; altre destinazioni o canali non sono oggetto di promesse qui salvo **estensione esplicita** (es. affitto, facility avanzata post-consegna).

**Messaggio COIMA (da usare in slide):**  
*Tecma copre in profondità CRM, trattative, calendario, configurazione unità e workflow commerciale; le aree “Parziale” si gestiscono con workflow e allegati o con integrazioni; le aree “No” richiedono processi esterni o sistemi specialistici — le rendiamo esplicite per evitare aspettative sbagliate.*

---

### 2. Cosa possiamo promettere (impegno realistico)

Allineato al gap (**Sì** + parte dei **Parziale** già soddisfacibili con configurazione):

| Area | Impegno verso COIMA |
|------|----------------------|
| **Anagrafica e lead** | CRM multi-progetto, duplicati, fonte, budget, interesse unità, **matching** cliente–unità. |
| **Pipeline commerciale** | Trattative, workflow configurabile, stati, **lock** unità dove previsto. |
| **Calendario** | Eventi per workspace/progetto; promemoria (evoluzione sync esterno in roadmap **FASE5**). |
| **Operatività commerciale** | Assegnazioni, ruoli, **RBAC**, cockpit e suggerimenti AI dove abilitati. |
| **Asset e configurazione** | Home Configurator, allegati, **S3** dove attivi; report ed export dove abilitati. |
| **Dati e integrazione** | **API** esposte per siti e terzi; analytics / GA4 dove configurato. |
| **Trasparenza** | Assessment numerico e tracciamento: ogni voce “Parziale” o “No” è **discutibile in workshop** con alternativa (configurazione vs integrazione vs roadmap). |

---

### 3. Cosa non promettiamo come capability nativa (chiarezza)

Non sono “ritardi Tecma sul generico testo COIMA”, ma **confini di prodotto** o **domini specialistici**:

| Tipo | Esempi tipici (dal gap) |
|------|-------------------------|
| **Legal / notarile / registro** | Registrazione preliminare, clausole legali automatiche, integrazione notai. |
| **Tesoreria e contabilità** | Pagamenti incassati, quietanze, flag contabili, corrispettivo, spese condominiali in gestione. |
| **AML / anti-riciclaggio** | Modulo AML dedicato. |
| **Facility fisica / presidio** | Presidio in loco, urgenze HVAC, coordinamento traslochi come prodotto. |
| **Post-consegna “ERP”** | Monitoraggio condominio, social listening, HR/ concierge — **No** nativo; possibili **integrazioni** o processo. |
| **PLM/BIM / cantiere fine** | Non sostituiamo piattaforme impresa/cantiere; restano **comunicazioni e allegati** in Tecma. |

**Messaggio COIMA:**  
*Per queste aree il percorso è: **processo + integrazione** o **fornitore specialistico**, non feature nascosta in roadmap generica.*

---

### 4. Prossimi passi concreti (con COIMA)

#### 4.1 Workshop requisiti (priorità)

1. **Validare le voci “Parziale”** per fase (Prospect → Post): per ciascuna decidere se *modello attuale* (note, workflow, HC, allegati) è sufficiente o serve **FASE prodotto** / **connettore**.
2. **Congelare l’elenco “No”** che non rientrano nel programma: evitare scope creep commerciale.
3. **Allineare aspettative sul portale cliente** e sul **preventivo digitale** (legati a **FASE2** e roadmap portale — vedi Parte II).

#### 4.2 Integrazioni e responsabilità

| Tema | Azione | Owner tipico |
|------|--------|--------------|
| Siti / lead / listing | API e chiavi già previste; definire **quali** flussi COIMA | Commerciale + integrazioni |
| Email marketing / newsletter | Roadmap **FASE6** connettori; definire tool target (es. Mailchimp) | Prodotto + COIMA |
| Calendario esterno | **FASE5** — decidere priorità vs altre FASE | Prodotto |
| Documenti e compliance | Cosa resta in Tecma vs DMS esterno | COIMA + legale |

#### 4.3 Checklist operativa (post-incontro)

- [ ] Verbale con **lista Parziale** con decisione: OK così / in roadmap / integrazione.
- [ ] Una **data** per riesame gap (es. dopo release major o trimestre).
- [ ] **Contatto unico** lato COIMA per chiarimenti requisiti (evita interpretazioni divergenti).

---

## Parte II — Piano interno Tecma (priorità e roadmap dal gap)

*Questa sezione è l’**allegato tecnico interno**: utile a PM/engineering; condivisibile con COIMA solo in estratto se serve fiducia sulla roadmap.*

### 5. Priorità prodotto ricavate dal gap

Priorità indicative (da rivedere a ogni pianificazione):

| Priorità | Tema | Motivo dal gap | Collegamento FASE / nota |
|----------|------|----------------|---------------------------|
| **P0** | Chiarezza commerciale e workshop | Ridurre ambiguità sui **Parziale** | Non è solo dev: processo + commerciale |
| **P1** | Preventivo / offerta digitale completa | Molte voci economiche in **Parziale** | **FASE2** (`FASE2_DIGITAL_QUOTE.md`) |
| **P1** | Inbox / solleciti / contratto operativo | Solleciti, inbox in evoluzione | **FASE7** (`FASE7_INBOX_CONTRACT.md`) |
| **P2** | Sync calendario esterno | Planning e pre-avviso | **FASE5** (`FASE5_CALENDAR_SYNC.md`) |
| **P2** | Connettori UX (email, marketing) | Newsletter, automazioni | **FASE6** (`FASE6_CONNECTORS_UX.md`) |
| **P2** | Dashboard condivisibili / reporting | Extra Tecma, stakeholder | **FASE4** (citata in gap / piano globale) |
| **Backlog** | Portale cliente unico “vita immobiliare” | Voci Parziale su area riservata | Spezzare in incrementi; non promettere monolite |

**Dipendenze:** ordine reale da `PIANO_GLOBALE_FOLLOWUP_3.md` e capacità team; la tabella è **guida**, non commitment di data.

---

### 6. Cosa non mettere in roadmap “silenziosa”

Per evitare debito con COIMA: **non** pianificare in backlog interno senza comunicazione le voci classificate **No** come se fossero feature CRM — restano **fuori** o **integrazione esplicita**.

---

### 7. Metriche interne di successo (engagement COIMA)

| Metrica | Obiettivo |
|---------|-----------|
| Requisiti **Parziale** con decisione documentata | Trend verso zero “ambigui” a ogni ciclo |
| Integrazioni concordate | Almeno N flussi definiti (API, connettori, DMS) |
| Allineamento release | Changelog condiviso quando una voce passa **Parziale → Sì** |

---

## Allegati e riferimenti

| Documento | Uso |
|-----------|-----|
| `docs/deliverables/COIMA_BTS_TECMA_GAP_ASSESSMENT.md` | Dettaglio riga per riga (70 requisiti) |
| `docs/PIANO_GLOBALE_FOLLOWUP_3.md` | Roadmap macro piattaforma |
| `docs/deliverables/FASE2_*.md`, `FASE5_*.md`, `FASE6_*.md`, `FASE7_*.md` | Specifiche per incrementi |
| UI Followup 3.0 `/coima` | Presentazione interattiva (grafici, filtri) — allineata a questo documento |

---

## Changelog documento

| Versione | Data | Note |
|----------|------|------|
| 1.0 | 2026-04-08 | Prima versione unificata (A+B+C+D); numeri da gap assessment v1.1 |

---

*Fine documento.*
