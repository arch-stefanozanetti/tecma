# Telemetria prodotto — discovery e allineamento legale

Questo documento supporta la **Fase 0** del piano neuro-metrics: interviste utenti e decisioni legali prima/durante il rollout.

## 1. Discovery utenti (suggerimento intervista 15–20 min)

Domande guida per 3–5 utenti (agente, backoffice, admin):

1. Nelle **prime 10 minuti** dopo l’accesso, quali azioni fai sempre? (ordine)
2. Quale schermata usi **più spesso** in una giornata tipica?
3. Dove ti sei **perso** o hai dovuto chiedere aiuto l’ultima volta?
4. Dopo un’azione importante (es. “ho chiamato il cliente”), come verifichi che sia **registrata**?
5. Cosa ti farebbe dire “oggi questo CRM mi ha fatto risparmiare tempo”?

**Output atteso:** elenco di 3–5 flussi critici da instrumentare per primi (allineati al catalogo eventi).

## 2. Allineamento legale (GDPR / lavoro)

| Tema | Check |
|------|--------|
| **Titolare del trattamento** | Chi è responsabile legalmente dei dati raccolti tramite analytics (Tecma vs cliente)? |
| **Base giuridica** | Legittimo interesse (analisi prodotto) vs consenso — validare con legale. |
| **DPA** | Con PostHog Cloud EU: firmare DPA e verificare sede dati (EU). |
| **Informativa privacy** | Aggiornare policy sito/app con finalità “miglioramento prodotto”, categorie dati, durata. |
| **Minimizzazione** | Nessun testo libero note, nessun dato sanitario in chiaro negli eventi (vedi catalogo). |
| **Diritti interessati** | Processo se un utente chiede export/cancellazione eventi (contatto PostHog o purge progetto). |
| **Ambiente** | In produzione usare **chiavi dedicate**; non riusare progetti di sviluppo personali. |

## 3. Scelta SaaS vs on-prem (riepilogo)

| Opzione | Quando |
|---------|--------|
| **PostHog (cloud EU)** consigliato | Time-to-value, funnel, feature flags, opt-in session replay. |
| **API backend + Mongo** | Policy che vietano dati fuori dal perimetro; costo manutenzione maggiore. |

Decisione registrata: **PostHog** come transport predefinito nel client FE (vedi `EVENT_CATALOG.md` e runbook).

## 4. Prossimi passi operativi

1. Compilare la tabella legale con il DPO / legale interno.
2. Creare progetto PostHog (regione EU) e variabili `VITE_PUBLIC_POSTHOG_*` in staging.
3. Dopo 2 settimane di baseline, riesame con product su funnel prioritari.
