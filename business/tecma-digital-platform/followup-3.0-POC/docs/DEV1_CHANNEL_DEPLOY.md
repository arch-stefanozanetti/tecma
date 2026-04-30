# Dev-1: deploy multi-canale (stesso dominio, path prefix)

Obiettivo: una **tendina** (o equivalente) che permetta di aprire **build FE diverse** (es. `main` vs branch feature) **senza cambiare dominio**, con testo descrittivo per canale.

## Vincolo

Una SPA statica serve **un** `index.html` + chunk per richiesta. Per avere codice da **branch Git diversi** servono **build diverse** pubblicate in **prefissi distinti** sullo stesso host (o edge routing avanzato).

## Schema URL (raccomandato)

| Canale | Esempio base | Sorgente build |
|--------|----------------|----------------|
| `main` | `https://<host-dev1>/app/main/` | branch `main` |
| `feature-keycloak` | `https://<host-dev1>/app/feature-keycloak/` | branch `feature/keycloak-migration` o `cursor/keycloak-identity-provider-b16b` |

- **Vite:** impostare il path pubblico con variabile d’ambiente di build `VITE_BASE_PATH=/app/<canale>/` (lo `vite.config` del FE imposta `base` e allinea PWA `start_url` / `navigateFallback`).
- **FE — tendina canali:** con `VITE_SHOW_DEV_CHANNEL_PICKER=true` la SPA carica `channels.json` (default) e mostra un selettore su login e in header; opzionale `VITE_CHANNELS_MANIFEST_URL`. Override BE per canale: campo `apiBaseUrlOverride` nel manifest (sessionStorage, vedi `devChannelStorage.ts`).
- **Render (static):** `publish` root = artefatto; se un unico servizio serve più cartelle, la pipeline deve **unire** gli output in una struttura tipo:

```text
dist/
  app/main/index.html + assets/...
  app/feature-keycloak/index.html + assets/...
```

Oppure **due job** che fanno `rsync`/upload in sottocartelle sullo stesso bucket/servizio (se supportato dalla piattaforma).

## Manifest `channels.json`

Servito dalla root del sito (es. `https://<host>/channels.json`) con elenco canali per la tendina:

Vedi esempio: [channels.manifest.example.json](./channels.manifest.example.json).

Campi:

- `id` — slug interno.
- `gitBranch` — branch Git di riferimento (informativo).
- `label` — titolo in UI.
- `description` — testo lungo per tooltip/help.
- `basePath` — es. `/app/main/` (sempre con slash finale coerente con `base` Vite).
- `apiBaseUrlOverride` (opzionale) — se un canale deve puntare a un BE diverso in dev-1.

La CI può **generare** questo file a partire da una lista di branch autorizzati.

## Comportamento tendina (FE)

- All’onchange: `const next = basePath + stripCurrentPrefix(location.pathname)` oppure navigazione a `basePath` + `login` se non si può mappare il path.
- Usare `window.location.assign(url)` per **reload completo** e caricare il bundle del canale.

## SPA fallback

Ogni prefisso `/app/<canale>/` deve avere rewrite `/*` → `index.html` del canale (stesso comportamento attuale per SPA). Verificare nella dashboard Render (o CDN) che le regole coprano **tutti** i prefissi pubblicati.

## Prossimi passi operativi

1. Aggiungere job CI che builda N branch con `base` diverso e pubblica sotto `/app/<id>/`.
2. Hostare `channels.json` statico o generato.
3. (Opzionale) Piccolo **shell** HTML/JS in root che legge `channels.json` e mostra la tendina prima di entrare nella SPA — oppure integrare la tendina in una pagina “portale” dev-only.
