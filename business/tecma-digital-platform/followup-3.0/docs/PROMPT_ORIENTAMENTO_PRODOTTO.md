# Prompt: Orientamento nel prodotto FollowUp 3.0

Le piattaforme che funzionano **non hanno manuali**. Hanno tre cose: **Home operativa**, **Onboarding guidato**, **Help contestuale**. Questo documento è il prompt/specifica per progettare l’**esperienza completa di orientamento**, non solo una pagina di spiegazione.

---

## 1. Istruzioni per l’agente

Sei un **product designer e SaaS UX architect** esperto in piattaforme complesse (CRM, ERP, SaaS B2B).

Stai progettando l’**esperienza utente di orientamento** per **FollowUp 3.0**, piattaforma SaaS per gestione immobili, clienti, trattative, affitti e vendite. L’obiettivo è rendere la piattaforma **facile da capire e usare** anche per utenti non tecnici, **senza** costringerli a leggere documentazione lunga o manuali.

Devi progettare **tre elementi**:

1. **Home operativa** (centro operativo: cosa fare + azioni rapide)
2. **Onboarding iniziale** (primo accesso: wizard guidato)
3. **Help contestuale** (micro-spiegazioni per sezione) + eventuale **pagina “Come funziona”** (flussi, non manuale)

L’esperienza deve essere: **molto chiara**, **sintetica**, **orientata alle azioni**, **non prolissa**.

**Output richiesto:**

1. Struttura completa della Home (blocchi, ordine, contenuti).
2. Elenco shortcut / quick actions principali, divisi per SELL e RENT.
3. Logica di personalizzazione per ruolo (Vendor, Front office, Vendor manager, Investor).
4. Struttura della pagina “Come funziona FollowUp” (flussi vendita e affitto, diagrammi semplici).
5. Flusso onboarding (step e progress).
6. Testi e posizionamento dell’help contestuale per le sezioni principali.
7. Best practice UX per SaaS complessi e regola “ogni schermata risponde a una domanda”.

---

## 2. Principio base: Home orientata alle azioni, non ai dati

La Home **non** deve essere una dashboard di widget/KPI (grafici vendite, grafici clienti). Diventano rapidamente inutili per gli utenti operativi.

Le piattaforme SaaS più efficaci (Linear, Stripe, Notion) usano una logica diversa:

- **Azioni → Attività → Contesto** (non: dati → grafici → statistiche).

La Home deve rispondere subito a **tre domande**:

1. **Cosa devo fare oggi?** (task concreti)
2. **Cosa sta succedendo nei miei progetti?** (contesto)
3. **Qual è l’azione più veloce da fare?** (shortcut)

**Regola (stile Linear/Stripe):** ogni schermata deve rispondere a **una domanda**.

| Schermata | Domanda |
|-----------|---------|
| Home | Cosa devo fare? |
| Clienti | Chi sono i clienti? |
| Appartamenti | Cosa sto vendendo/affittando? |
| Trattative | A che punto siamo? |
| Calendario | Cosa ho in agenda? |

---

## 3. Struttura ideale della Home

Layout proposto (ordine dall’alto in basso):

```
HOME
────────────────────────────────────

1. Quick Actions
2. Task di oggi
3. Agenda (prossimi appuntamenti)
4. Le mie trattative (pipeline compatta)
5. Attività recenti (feed)
6. Insights progetto (solo per ruoli manager/investor)
```

**Errore da evitare:** una home tipo “grafico vendite + grafico clienti + grafico prezzi”. Gli utenti operativi non li guardano.

---

## 4. Quick Actions (parte prioritaria)

Bottoni/azioni grandi e chiare. **Divisi per business: SELL vs RENT.**

**SELL (vendita)**

- + Nuovo buyer (cliente acquirente)
- + Nuovo seller (cliente venditore)
- + Nuova trattativa vendita
- Crea appartamento
- Importa appartamenti da Excel
- Gestisci prezzi (vendita)

**RENT (affitto)**

- + Nuovo inquilino (cliente)
- + Imposta prezzo mensile
- + Nuova trattativa affitto
- Crea appartamento
- Importa appartamenti (se applicabile)

**Comuni**

- Agenda / Appuntamenti
- (Opzionale) Task dedicata

La Home deve rendere **chiara la distinzione** tra vendita e affitto (sezioni separate o tab SELL / RENT).

---

## 5. Task di oggi (paradigma “Oggi devi”)

**Il salto di qualità:** la Home orientata ai **task**, non ai dati.

Non mostrare solo “dati”. Mostrare **azioni da fare**.

Esempi di contenuto:

- Oggi devi:
  - Richiamare 3 clienti
  - Fare 2 visite
  - Aggiornare 1 proposta
  - Scadenza proposta cliente Rossi

Questo rende il CRM **utile ogni giorno**. (Segue il modello “suggerimenti” già presente in parte in CockpitPage con le action card; va potenziato con task derivati da reminder, scadenze, proposte in attesa, visite da confermare.)

---

## 6. Agenda

- **Compatta:** prossimi appuntamenti (oggi / questa settimana).
- Esempio: `09:30 visita A12 · 11:00 chiamata Bianchi · 15:00 visita C3`.
- **Front office:** vede tutte le agende (o per team).
- **Vendor:** vede solo la propria agenda.

Collegamento con la sezione Calendario (navigazione rapida).

---

## 7. Le mie trattative

- Pipeline **compatta** (non la pagina intera): lead → visita → proposta → contratto.
- Con **numeri** per stadio (es. lead: 12, visite: 6, proposte: 2).
- Per **Vendor**: solo “le mie” trattative (scope assigned).
- Per **Vendor manager**: pipeline team / globale.

---

## 8. Attività recenti (feed)

- Esempi: “Marco ha creato cliente Rossi”, “Anna ha inserito appartamento B12”, “Proposta inviata a cliente Verdi”.
- Utile per **coordinare i team** e dare contesto.
- Breve (ultime 5–10 attività).

---

## 9. Insights progetto (solo per ruoli manager / investor)

- **Manager:** appartamenti disponibili, venduti, trattative aperte, conversione visite → proposta.
- **Investor:** solo dati aggregati (vendite totali, unità disponibili, trend); nessun dato personale su clienti.

---

## 10. Personalizzazione per ruolo

La Home deve **cambiare** in base al ruolo (vedi [PROMPT_RUOLI_E_VISIBILITA.md](PROMPT_RUOLI_E_VISIBILITA.md)).

| Ruolo | Contenuti Home principali |
|-------|----------------------------|
| **Vendor** | Quick actions, Task di oggi, Agenda (propria), Le mie trattative |
| **Front office** | Quick actions, Agenda generale, Visite di oggi, Clienti da contattare |
| **Vendor manager** | Quick actions, Pipeline vendite, Performance venditori, Trattative critiche |
| **Investor** | Vendite totali, Unità disponibili, Trend vendite (solo aggregati) |
| **Account admin** | Come Vendor manager + shortcut a Utenti, Workspace, Configurazione |

---

## 11. Pagina “Come funziona FollowUp”

- **Non** un manuale. **Niente** wall of text.
- Spiegare il sistema con **flussi semplici** (diagrammi/testo lineare).

**Flusso VENDITA**

1. Crea appartamento (o importa da Excel)
2. Inserisci cliente (buyer/seller)
3. Crea trattativa
4. Gestisci proposta
5. Chiudi contratto

**Flusso AFFITTO**

1. Inserisci appartamento
2. Imposta prezzo mensile
3. Inserisci cliente (inquilino)
4. Crea trattativa
5. Firma contratto

Posizionamento: link “Come funziona” in header/footer o in onboarding; pagina dedicata con solo questi flussi + eventuale mappa delle sezioni (Home, Clienti, Appartamenti, Trattative, Calendario).

---

## 12. Onboarding (primo accesso)

Quando un utente entra **per la prima volta**, mostrare un onboarding semplice (wizard).

**Step suggeriti:**

1. Crea il primo progetto immobiliare (o scegli workspace/progetto)
2. Inserisci il primo appartamento
3. Aggiungi un cliente
4. Crea la prima trattativa

Con **progress bar** e possibilità di “Salta per ora” (con link a “Come funziona” e alla Home). Al completamento: redirect alla Home operativa.

---

## 13. Help contestuale

Ogni **sezione** principale ha una **micro-spiegazione** (1–2 righe), sempre visibile (es. sotto il titolo o in un tooltip “?”).

Esempi:

| Sezione | Testo |
|---------|--------|
| **Appartamenti** | Gli appartamenti sono le unità immobiliari del progetto. Puoi inserirli manualmente o importarli da Excel. |
| **Clienti** | I clienti sono le persone interessate a comprare, vendere o affittare un immobile. |
| **Trattative** | Le trattative collegano un cliente a un appartamento e seguono gli stati del workflow (lead, visita, proposta, contratto). |
| **Calendario** | Qui vedi gli appuntamenti e le visite. Puoi fissare e gestire gli incontri con i clienti. |
| **Prezzi** | Qui gestisci i listini: prezzo vendita, canone mensile o prezzi per data (short stay). |

Requisiti: **brevi**, **chiare**, **sempre visibili** (o con ? contestuale).

---

## 14. Architettura UI (sezioni principali)

Proposta di navigazione principale:

- **Home** (cockpit)
- **Task** (opzionale: vista task dedicata, altrimenti task solo in Home)
- **Agenda / Calendario**
- **Appartamenti**
- **Clienti**
- **Trattative**
- **Prezzi** (gestione listini)
- **Progetti**
- **Utenti** (admin)
- (Altro: Report, Integrazioni, Config workflow, Workspaces)

Allineare al menu esistente ([PageTemplate](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/shared/PageTemplate.tsx): Home, Appartamenti, Clienti, Trattative, Calendario, Progetti, ecc.

---

## 15. Suggerimenti automatici (evoluzione “CRM intelligente”)

Idee per differenziare FollowUp:

- Esempio: “3 clienti cercano un trilocale 80–100 m². Potrebbero essere interessati all’appartamento A12.”
- Integrazione con matching / AI suggestions (già parzialmente presente in CockpitPage) per alimentare “Task di oggi” e “Azioni suggerite”.

Da considerare in una fase successiva; il prompt può citarla come **evoluzione desiderata**.

---

## 16. Riferimenti nel codebase

- **Home attuale:** [CockpitPage](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/cockpit/CockpitPage.tsx) – titolo “Cosa fare oggi”, action cards (da AI suggestions o mock), eventi di oggi, KPI. Evolvere verso: Quick Actions in evidenza, Task di oggi espliciti, Agenda, Pipeline compatta, Attività recenti, Insights per ruolo.
- **Navigazione:** [PageTemplate](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/shared/PageTemplate.tsx) – voci: Home, Appartamenti, Clienti, Trattative, Calendario, Progetti, ecc.
- **App e sezioni:** [App.tsx](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/App.tsx) – `section` e routing; aggiungere sezione “comeFunziona” e flusso onboarding se non presenti.

L’agente deve **allineare** la proposta a questa struttura e indicare dove introdurre nuovi blocchi (Quick Actions, Task di oggi, pagina Come funziona, onboarding, help contestuale).

---

## 17. Riepilogo output richiesto

Fornire:

1. **Struttura completa della Home** (blocchi, ordine, contenuti per ruolo).
2. **Elenco shortcut / quick actions** (SELL vs RENT).
3. **Logica di personalizzazione per ruolo** (cosa vede Vendor, Front office, Vendor manager, Investor).
4. **Struttura pagina “Come funziona FollowUp”** (flussi vendita e affitto, nessun manuale).
5. **Flusso onboarding** (step, progress, skip).
6. **Help contestuale** (testi e posizionamento per Appartamenti, Clienti, Trattative, Calendario, Prezzi).
7. **Best practice UX** per SaaS complessi e applicazione della regola “ogni schermata risponde a una domanda”.

Opzionale: proposta per **Task** come sezione dedicata o solo integrata in Home; proposta per **suggerimenti automatici** (match clienti–appartamenti) in Home/Task.
