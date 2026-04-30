# Variabili Render — Followup 3.0 (FE + BE)

Se il messaggio è **«Impossibile raggiungere le API … Failed to fetch»** dal sito statico verso il backend, quasi sempre è **CORS**: il backend non ha tra le origini consentite l’URL del frontend.

## Backend (`followup-3-be`)

| Variabile | Valore tipico |
|-----------|----------------|
| `APP_PUBLIC_URL` | `https://followup-3-fe.onrender.com` (URL pubblico del sito statico, **senza** slash finale) |
| `CORS_ORIGINS` | (opzionale) altri domini, separati da virgola |

Dopo il deploy, `APP_PUBLIC_URL` può elencare più origini separate da virgola, es.  
`https://followup-3-fe.onrender.com,http://localhost:5177`

### Integrazione Jira Cloud (Product Blueprint — solo server)

Usata dalla pagina **Product Blueprint** (`/tecma/product-blueprint`, Tecma Admin) per creare issue e leggere lo stato. **Non** esporre token al browser: solo env sul servizio API.

| Variabile | Obbligatorio | Note |
|-----------|--------------|------|
| `JIRA_HOST` | sì* | Host Atlassian, es. `tuodominio.atlassian.net` (senza `https://` va aggiunto dal codice) |
| `JIRA_EMAIL` | sì* | Account Atlassian collegato al token API |
| `JIRA_API_TOKEN` | sì* | Token API da [Atlassian](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | sì* | Chiave progetto Jira, es. `TECMA` |
| `JIRA_ISSUE_TYPE_STORY` | no | Default `Story` |
| `JIRA_ISSUE_TYPE_SUBTASK` | no | Default `Sub-task` |

\*Se una qualsiasi delle quattro è assente, l’integrazione risulta disattivata: catalogo e UI funzionano, ma publish/sync Jira non sono disponibili (503 su publish).

## Frontend statico (`followup-3-fe`) — build

| Variabile | Valore tipico |
|-----------|----------------|
| `VITE_API_BASE_URL` | `https://followup-3-be.onrender.com/v1` (**obbligatorio** `/v1` in coda) |

| `VITE_PUBLIC_POSTHOG_KEY` | (opzionale) Chiave progetto PostHog EU; se assente la telemetry prodotto non parte |
| `VITE_PUBLIC_POSTHOG_HOST` | (opzionale) Default `https://eu.i.posthog.com` |

Impostare in **Environment** del servizio statico (Build-time env), poi **Clear build cache & deploy**.

## Verifica rapida

1. Da browser: apri DevTools → Network → una richiesta verso il BE: se **nessuna risposta** e in console errore CORS, controlla `APP_PUBLIC_URL` sul BE.
2. `curl -I https://followup-3-be.onrender.com/v1/health` deve rispondere 200.
