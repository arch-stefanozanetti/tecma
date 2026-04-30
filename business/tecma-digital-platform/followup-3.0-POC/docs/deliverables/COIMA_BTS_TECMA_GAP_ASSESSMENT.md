# Assessment tecnico — BTS clienti, processi e SW (visione COIMA) vs Tecma Platform (Followup 3.0)

**Documento di lavoro** — per condivisione con stakeholder (es. COIMA).  
**Versione:** 1.1 · **Data:** 2026-04-08  
**Fonte requisiti:** documento *BTS clienti, attività, processi e SW TECMA* (estratti testuali per sezione e sottopunto).

**Contesto progetto (COIMA):** il complesso è inquadrato come **mixed-use** in contesto **sicuro**; da parte COIMA la priorità operativa e commerciale dichiarata è il **build-to-sell** — concentrare risorse e racconto sul canale vendita. Questo assessment segue il perimetro **vendita / ciclo cliente BTS**; altre destinazioni o canali restano fuori focus in questo documento salvo estensione esplicita.

---

## 1. Sintesi esecutiva

Il documento COIMA descrive una catena **Prospect → Preliminare → Vita fino a consegna → Post consegna**, con sottopunti operativi.  
Questo assessment risponde, **per ogni sottopunto**, alla domanda: **in Tecma (Followup 3.0) esiste già, è solo parzialmente coperto, o non esiste?**  
Dove Tecma ha **funzionalità aggiuntive** rispetto al testo COIMA, sono indicate nella colonna **Extra Tecma** (tanto meglio per il dialogo commerciale).

**Legenda colonna «In Tecma»**

| Valore | Significato |
|--------|-------------|
| **Sì** | Funzionalità di prodotto o modello dati previsto (anche se va configurato il workflow / il progetto). |
| **Parziale** | Tracciabile con strumenti generici (note, allegati, stati workflow, HC, campi su cliente/trattativa) ma **non** un modulo dedicato identico al processo COIMA. |
| **No** | Non previsto come capability nativa; resta processo esterno, altro sistema o integrazione da definire. |

---

## 2. Prospect

Sottopunti ricavati dal documento (fase iscrizione / lead / prima trattativa).

| # | Sottopunto (COIMA) | In Tecma | Note | Extra Tecma (oltre il testo COIMA) |
|---|---------------------|----------|------|-------------------------------------|
| 1 | Dati personali anagrafici | **Sì** | Clienti `tz_clients`: nome, contatti, stato, storico. | Matching cliente–unità; duplicati email per workspace. |
| 2 | Privacy / consensi | **Parziale** | Flag profilazione, trattamento, marketing e documentazione GDPR in `docs/`. | Attribution marketing (UTM/gclid) per analytics. |
| 3 | Residenza / indirizzo | **Parziale** | Città e dati famiglia dove presenti; indirizzo completo se in `additionalInfo` / estensioni. | — |
| 4 | Fonte contatto | **Sì** | Campo `source` su cliente. | — |
| 5 | Tipologie di appartamento di interesse | **Sì** | Unità selezionate / interessate collegate al cliente. | Catalogo appartamenti multi-progetto. |
| 6 | Primi riferimenti di budget | **Sì** | Campo `budget` (cliente). | — |
| 7 | Gestione appuntamenti | **Sì** | Calendario (eventi per workspace/progetto). | — |
| 8 | Feedback appuntamenti | **Parziale** | Tracciabile con note su cliente o evento; **non** un questionario standard post-visita in prodotto. | — |
| 9 | Gestione richieste (pipeline) | **Sì** | Trattative `tz_requests` + workflow configurabile. | Stati terminali, lock unità dove configurato. |
| 10 | Materiale fornito e inviato | **Parziale** | Comunicazioni e allegati dove previsti dal flusso; non un “DMAT” unico numerato. | Connettori verso strumenti di invio (roadmap). |
| 11 | Scambio ulteriore di informazioni | **Parziale** | Note, thread comunicazioni, allegati. | AI suggestion / cockpit (dove abilitato). |
| 12 | Consulente commerciale che ha gestito il caso | **Sì** | Assegnazione entità (`tz_entity_assignments`) e ruoli. | RBAC granulare per modulo/azione. |
| 13 | Nuovi appuntamenti | **Sì** | Calendario. | — |
| 14 | Raccolta documenti | **Parziale** | Documenti cliente dove il modulo è attivo (`client-documents`); copertura dipende da deploy/permessi. | — |
| 15 | Procedura AML | **No** | Nessun modulo AML dedicato in Followup 3.0. | — |

**Extra complessivi fase Prospect (non sempre espliciti nel doc COIMA):** workspace multi-tenant, progetti multipli, **Big Data / GA4** dove configurato, **API pubbliche** (`platform`) per lead/listing, **cockpit** con suggerimenti aggregati.

---

## 3. Cliente — Preliminare

| # | Sottopunto (COIMA) | In Tecma | Note | Extra Tecma |
|---|---------------------|----------|------|-------------|
| 1 | Intestatari del preliminare | **Parziale** | Trattativa e soggetti collegabili a cliente/unità; struttura “intestatari multipli” se non modellata 1:1 col legale. | — |
| 2 | Prima o seconda casa (IVA) | **Parziale** | Tracciabile in metadati / note / preventivo in evoluzione. | — |
| 3 | Prezzo | **Sì/Parziale** | Prezzo in trattativa/quote dove presente; **FASE2** preventivo digitale per completezza. | — |
| 4 | Importo caparra e acconti | **Parziale** | Voci economiche in evoluzione (quote); non contabilità completa. | — |
| 5 | Termini di consegna | **Parziale** | Milestone / date in progetto o note; non Gantt cantiere nativo. | — |
| 6 | Unità, cantina, box | **Sì** | Appartamenti e associazioni cliente–unità. | Planimetrie / asset S3 dove configurato. |
| 7 | Capitolato | **Parziale** | Allegati e testi su trattativa/progetto; non editor capitolato dedicato. | — |
| 8 | Clausole adeguamento prezzo (es. ISTAT) | **No** | Non motore clausole legali. | — |
| 9 | Penali per ritardi | **Parziale** | Note / campo custom se introdotto; non calcolo automatico. | — |
| 10 | Termini personalizzazioni vs avanzamento lavori | **Parziale** | HC e milestone “soft”; vincolo stretto cantiere → **No** come automazione nativa. | Home Configurator (varianti). |
| 11 | Rilascio fideiussioni (es. L. 210) | **No** | Workflow legale/assicurativo esterno. | — |
| 12 | Registrazione del preliminare | **No** | Adempimento notarile/registro esterno. | — |
| 13 | Gestione pagamenti / assegni | **No** | Nessun modulo tesoreria/pagamenti incassati. | — |
| 14 | Rilascio quietanza | **No** | Documento contabile esterno. | — |
| 15 | Area riservata cliente (web/app) con storico “vita immobiliare” | **Parziale** | CRM interno completo; **portale cliente unico** tipo “tutto il ciclo” in roadmap a pezzi (magic link, quote, doc — vedi piano). | Stesso dato su trattativa per team interno. |

---

## 4. Vita immobiliare (fino a consegna)

| # | Sottopunto (COIMA) | In Tecma | Note | Extra Tecma |
|---|---------------------|----------|------|-------------|
| 1 | Richieste varie | **Sì** | Trattative + task/comunicazioni. | Workflow personalizzabile per workspace. |
| 2 | Planning pagamenti acconti | **Parziale** | Promemoria/calendario; non pianificazione finanziaria integrata. | — |
| 3 | Planning e pre-avviso | **Parziale** | Calendario + notifiche dove attive. | FASE5 sync calendario esterno (roadmap). |
| 4 | Solleciti | **Parziale** | Reminder/inbox in evoluzione; **FASE7** contratto inbox. | — |
| 5 | Aggiornamento DB “flag pagato” | **No** | Non contabilità; eventuale campo custom manuale. | — |
| 6 | Eventuali pre-contenziosi | **Parziale** | Note e stati; non case legal management. | — |
| 7 | Personalizzazioni layout (std / custom architetto) | **Parziale** | **HC** e varianti; custom con architetto = processo + allegati. | Editor planimetrie / sperimentalità (es. Pascal) dove in roadmap. |
| 8 | Preventivi – approvazione – pagamenti | **Parziale** | Offerte/quote in evoluzione (**FASE2**); pagamenti → **No**. | — |
| 9 | Interazione team progetto / impresa (tempi, certificazioni, aggiornamento esecutivo) | **Parziale** | Comunicazioni e allegati; **non** PLM/BIM integrato. | — |
| 10 | Scelta finiture (mood / a la carte) | **Parziale** | HC finiture dove configurato per progetto. | Cataloghi e template HC. |
| 11 | Negoziazione set varianti in gara (mark-up) | **No** | Logica economica offerta vs impresa non nativa. | — |
| 12 | Home configurator + showroom partner | **Parziale** | HC sì; gestione fisica showroom → processo. | — |
| 13 | Aggiornamenti periodici, newsletter, auguri, eventi | **Parziale** | Automazioni email / connettori (Mailchimp, ActiveCampaign) in roadmap **FASE6**. | — |
| 14 | Gestione complain / pre-contenzioso / contenzioso | **Parziale** | Tracciamento leggero su trattativa; non ticketing legale. | — |
| 15 | Informazioni su tempistiche effettive di consegna | **Parziale** | Date/milestone a livello progetto o comunicazione; non campo “data certa” automatica da cantiere. | — |
| 16 | Regolamento condominio | **Parziale** | Allegato/documento sì; processo condominiale → **No**. | — |
| 17 | Misurazioni vani per arredo | **No** | Non strumento misurazione; allegati manuali. | — |
| 18 | Pre-consegna: pulizia, visita, verbale NC | **Parziale** | Verbale come doc/checklist se definita in progetto; workflow dedicato NC → **Parziale/No**. | — |
| 19 | Condivisione stato risoluzione NC con cliente | **Parziale** | Portale limitato; internamente note/allegati. | — |
| 20 | Consegna: pulizia finale, verbale, variazione intestatari | **Parziale** | Dati anagrafici e note; variazione intestatari = adempimento notarile esterno. | Associazioni `future` (proposta/compromesso/rogito) in seme demo. |
| 21 | Appuntamenti notaio, preventivi | **Parziale** | Calendario + note; integrazione notai **No**. | — |
| 22 | Pagamento corrispettivo / contabilità | **No** | — | — |
| 23 | Prima tranche spese condominiali | **No** | — | — |
| 24 | Consegna chiavi, telecomandi, manuali SW, regolamento SW | **Parziale** | Checklist/documenti se modellati; non gestione inventario fisico. | — |
| 25 | Attivazione cablaggi / WiFi | **No** | Operativo/telco. | — |
| 26 | Selezione amministratore e integrazione suoi applicativi | **No** | — | Integrazioni generiche in roadmap. |
| 27 | Partecipazione assemblee | **No** | — | — |
| 28 | Budget spese, contratti manutenzione | **No** | — | — |
| 29 | Selezione personale front-end (concierge) | **No** | HR/operativo. | — |

---

## 5. Vita immobiliare (post consegna)

| # | Sottopunto (COIMA) | In Tecma | Note | Extra Tecma |
|---|---------------------|----------|------|-------------|
| 1 | Ripristino NC post rogito | **Parziale** | Ticket leggeri solo se modellati come richieste/note; **non** FM completo. | — |
| 2 | Presa appuntamenti, verbali esecuzione opere | **Parziale** | Come sopra. | — |
| 3 | Mappatura no-show o ritardi impresa | **No** | — | — |
| 4 | Presidio COIMA in loco | **No** | Attività fisica. | — |
| 5 | Presidio impresa in loco | **No** | — | — |
| 6 | Gestione urgenze (perdite, HVAC, …) | **No** | Call center / facility. | — |
| 7 | Social media, complain, monitoraggio | **No** | Listening nativo assente; export verso tool esterni possibile in astratto. | — |
| 8 | Coordinamento traslochi | **No** | — | — |
| 9 | Monitoraggio condominio e spese | **No** | ERP condominio esterno. | — |
| 10 | Check impianti stagionali | **No** | — | — |
| 11 | Complain formali, pre-contenzioso, contenzioso | **Parziale** | Stati/note su relazione commerciale; non legal case management. | — |

---

## 6. Cose in più in Tecma (riepilogo trasversale)

Utili da esplicitare in presentazione se COIMA elenca solo il percorso “ideale”:

- **Multi-workspace / multi-progetto** con **RBAC** e **assegnazioni** (chi lavora cosa).
- **Workflow** vendita/affitto configurabile (`tz_workflow_*`) e **lock** unità.
- **Home Configurator** e asset **S3** dove attivi.
- **Matching** cliente–unità (endpoint dedicati).
- **Cockpit** e **AI suggestions** (wave prodotto) per priorità operative.
- **Big Data / analytics** (es. GA4) dove configurato.
- **API** esposte (`openapi`, platform key) per integrare siti e terzi senza duplicare CRM.
- **Report** ed export dove abilitati; roadmap su dashboard condivisibili (**FASE4**).

---

## 7. Rischi e decisioni con il cliente

1. Allineare le aspettative: le celle **No** non sono “ritardi Tecma” su tutto il testo COIMA, ma **confine di prodotto** (PM, legal pesante, tesoreria, social, presidio fisico).
2. Per ogni **Parziale**, in workshop si decide se basta il modello attuale o serve **FASE** (preventivo, inbox, portale) / **integrazione**.
3. Aggiornare questo file quando una voce passa da Parziale → Sì (release).

---

## 8. Riferimenti interni

- **`docs/deliverables/COIMA_TECMA_ALLINEAMENTO_E_PIANO.md`** — allineamento commerciale con COIMA, promesse / non-promesse, prossimi passi e piano interno Tecma (stesso file, lettura cliente vs allegato tecnico).
- `docs/PIANO_GLOBALE_FOLLOWUP_3.md`
- `docs/deliverables/FASE2_DIGITAL_QUOTE.md`, `FASE5_CALENDAR_SYNC.md`, `FASE6_CONNECTORS_UX.md`, `FASE7_INBOX_CONTRACT.md`
- `docs/CLIENT_APARTMENT_MODEL.md`, `docs/REQUESTS_MODEL.md`, `docs/MAIN_DB_SCHEMA.md`

---

*Fine documento.*
