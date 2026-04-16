# Runbook — Product Blueprint (Jira) Followup 3.0

## Chi può accedere

- Solo utenti con **`isTecmaAdmin`** (JWT / system role Tecma).
- Serve permesso di sezione coerente con la nav (es. `settings.read` come per altre voci Tecma admin).

## Dove si trova

- **Frontend:** menu amministrazione → **Product Blueprint (Jira)** oppure URL diretto `/tecma/product-blueprint`.
- **API backend:** prefisso `/v1/jira-prd` (`GET /catalog`, `GET /status`, `POST /publish`).

## Prerequisiti Jira

1. Impostare sul servizio **be-followup-v3** le variabili documentate in [RENDER_FOLLOWUP_ENV.md](./RENDER_FOLLOWUP_ENV.md) (sezione Jira).
2. Il progetto Jira deve avere tipi issue compatibili con **Story** e **Sub-task** (o i nomi configurati in `JIRA_ISSUE_TYPE_*`).
3. L’account `JIRA_EMAIL` deve poter creare issue nel progetto `JIRA_PROJECT_KEY`.

## Flusso operativo

1. **Catalogo:** la tabella elenca le funzionalità da `feature-catalog` lato backend.
2. **Selezione:** filtri per area / testo; checkbox per le righe da pubblicare.
3. **Anteprima testi:** apre un modale con summary e testi per disciplina (FE/BE/DB/UX/QA/Test).
4. **Pubblica su Jira:** crea una **Story** e sei **Sub-task** per ogni `idTema` selezionato; salva i key in Mongo (`tz_jira_prd_links`).
5. **Già pubblicato:** senza flag “Forza”, le righe già mappate vengono saltate (`already_published_use_force`). Con **Forza**, il documento Mongo viene rimosso e vengono create nuove issue (le vecchie restano orfane su Jira — uso solo per test/POC).
6. **Aggiorna stato da Jira:** chiama la search API e mostra avanzamento **done** e badge **Completato** quando tutte le issue della riga sono in stato Done/Closed (o categoria `done`).

## Verifica rapida

- Con env Jira assenti: banner giallo in pagina; `POST /publish` → 503.
- Con env corrette: dopo publish, link alla Story nella colonna “Story Jira”; dopo cambio stato in Jira, “Aggiorna stato” riflette i progressi.
