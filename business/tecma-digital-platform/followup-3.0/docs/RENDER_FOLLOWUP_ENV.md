# Variabili Render — Followup 3.0 (FE + BE)

Se il messaggio è **«Impossibile raggiungere le API … Failed to fetch»** dal sito statico verso il backend, quasi sempre è **CORS**: il backend non ha tra le origini consentite l’URL del frontend.

## Backend (`followup-3-be`)

| Variabile | Valore tipico |
|-----------|----------------|
| `APP_PUBLIC_URL` | `https://followup-3-fe.onrender.com` (URL pubblico del sito statico, **senza** slash finale) |
| `CORS_ORIGINS` | (opzionale) altri domini, separati da virgola |

Dopo il deploy, `APP_PUBLIC_URL` può elencare più origini separate da virgola, es.  
`https://followup-3-fe.onrender.com,http://localhost:5177`

## Frontend statico (`followup-3-fe`) — build

| Variabile | Valore tipico |
|-----------|----------------|
| `VITE_API_BASE_URL` | `https://followup-3-be.onrender.com/v1` (**obbligatorio** `/v1` in coda) |

Impostare in **Environment** del servizio statico (Build-time env), poi **Clear build cache & deploy**.

## Verifica rapida

1. Da browser: apri DevTools → Network → una richiesta verso il BE: se **nessuna risposta** e in console errore CORS, controlla `APP_PUBLIC_URL` sul BE.
2. `curl -I https://followup-3-be.onrender.com/v1/health` deve rispondere 200.
