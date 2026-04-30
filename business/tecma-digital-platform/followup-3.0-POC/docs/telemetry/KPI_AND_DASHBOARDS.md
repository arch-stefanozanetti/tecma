# KPI north-star e dashboard (PostHog)

Documento operativo per **baseline** e revisione mensile (allineato al catalogo eventi v1).

## Tre KPI north-star (proposta iniziale)

| KPI | Definizione operativa | Perché |
|-----|------------------------|--------|
| **Attività cliente / utente attivo / settimana** | Conteggio unico `task.client.log_action` per `distinct_id` (o per workspace se si filtra così), finestra 7 giorni rolling | Misura “chiusura loop” operativa sul CRM |
| **Engagement richieste** | Rapporto `flow.request.board_view` → azioni successive correlate (es. eventi dominio su richieste, se aggiunti in seguito) oppure frequenza settimanale della sola `board_view` come proxy | Capisce se il modulo richieste è parte del lavoro quotidiano |
| **Salute UX (attrito)** | Tasso `error.ui.shown` / sessioni con `app.session.start` (stesso periodo), eventualmente per `workspace_id` | Indica stress percepito e possibile bisogno di copy/validazione |

Aggiornare le definizioni dopo 2–4 settimane di dati reali (soglie, segmenti ruolo).

## Dashboard consigliate in PostHog

1. **Funnel “navigazione → azione”**  
   - Step 1: `app.route.view` con `section` = `cockpit` o `requests` o `clients`  
   - Step 2: `task.client.log_action` **oppure** `flow.request.board_view` (due funnel separati se serve chiarezza)

2. **Cohort**  
   - Utenti che hanno almeno un `app.session.start` nella settimana 0  
   - Ritorno: almeno un altro `app.session.start` nelle settimane 1–3

3. **Integrazioni**  
   - `integr.page.view` → `integr.marketing.oauth_click` (filtro `provider` = `google` / `meta`, `surface` = `integrations` | `bigdata`)

## Revisione

- **Mensile**: funnel principale e confronto con mese precedente  
- **Trimestre**: collegamento a backlog ipotesi UX ([UX_HYPOTHESES_BACKLOG.md](UX_HYPOTHESES_BACKLOG.md))
