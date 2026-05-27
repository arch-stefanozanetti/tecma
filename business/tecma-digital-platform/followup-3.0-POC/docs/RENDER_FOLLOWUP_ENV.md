# Variabili Render — Followup 3.0 POC (FE + BE)

**Attenzione:** sul frontend statico, se **`VITE_API_BASE_URL` non è impostata in fase di build**, il codice usa il default `"/v1"` (vedi `src/api/http.ts`): le richieste vanno al **dominio del sito statico**, non al backend → login e tutte le API risultano rotti. Imposta sempre `VITE_API_BASE_URL=https://followup-3-be.onrender.com/v1` (Build env) e ridistribuisci.

Se il messaggio è **«Impossibile raggiungere le API … Failed to fetch»** dopo aver sistemato l’URL API, controlla **CORS**: il backend deve avere tra le origini consentite l’URL del frontend (`APP_PUBLIC_URL`).

## Backend (`followup-3-be`)

| Variabile | Valore tipico |
|-----------|----------------|
| `APP_PUBLIC_URL` | `https://followup-3-fe.onrender.com` (URL pubblico del sito statico, **senza** slash finale) |
| `CORS_ORIGINS` | (opzionale) altri domini, separati da virgola |

### Email inviti utente (obbligatorio per creazione collaboratore)

Senza SMTP configurato, `POST /v1/users` e `POST /v1/workspaces/:id/invitations` rispondono **503** (invio email non configurato). In produzione usare **SES SMTP**.

| Variabile | Obbligatorio | Valore tipico |
|-----------|--------------|----------------|
| `EMAIL_TRANSPORT` | sì | `smtp` (in locale/test: `mock` + `INVITE_ALLOW_MOCK_EMAIL=true`) |
| `SES_SMTP_HOST` | sì con smtp | `email-smtp.eu-central-1.amazonaws.com` |
| `SES_SMTP_PORT` | no | `587` |
| `SES_SMTP_USER` | sì con smtp | Username IAM SMTP SES |
| `SES_SMTP_PASS` | sì con smtp | Password IAM SMTP SES |
| `EMAIL_FROM` | sì con smtp | Mittente verificato in SES, es. `noreply@tuodominio.it` |
| `INVITE_TOKEN_EXPIRES_HOURS` | no | `168` (7 giorni) |
| `INVITE_LINK_ALLOWED_HOSTS` | no | Host extra per link invito (virgola) |
| `INVITE_ALLOW_MOCK_EMAIL` | no | `true` solo dev/staging senza consegna reale |

Il link nell’email punta a `{APP_PUBLIC_URL}/set-password?token=...` — **`APP_PUBLIC_URL` deve coincidere con l’URL del frontend statico**.

Dopo deploy BE: invita un utente di test dal wizard **Utenti**; verifica email e completamento su `/set-password`.

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
3. Verifica proprietà dominio Aikido (file sul BE): `curl -sS https://followup-3-be.onrender.com/aikido.txt` deve rispondere 200 con il token atteso (route root `registerRootPublicRoutes` in `be-followup-v3`). Sul FE statico esiste anche `public/aikido.txt` per lo stesso token se Aikido richiede l’URL `followup-3-fe`.
