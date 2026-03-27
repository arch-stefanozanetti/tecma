# Experimental Editor (`/experimental/editor`)

Integrazione di `pascalorg/editor` come applicazione separata, accessibile dal Followup Hub `/experimental` solo per utenti `isTecmaAdmin`.

## Struttura

- Host app Followup: `fe-followup-v3`
- App sperimentale: `experimental/pascal-editor` (Next.js)
- Hub interno Followup: `/experimental`
- Path editor separato: `/experimental/editor`

## Avvio locale

1. Avvia backend + frontend + editor:

```bash
cd followup-3.0
npm run dev:all
```

2. In alternativa avvia solo editor:

```bash
cd followup-3.0/experimental/pascal-editor
bun install
bun run dev
```

## Variabili ambiente

### Frontend Followup (`fe-followup-v3`)

- `VITE_EXPERIMENTAL_EDITOR_URL` (default `/experimental/editor`)
- `VITE_EXPERIMENTAL_EDITOR_PROXY_TARGET` (default `http://localhost:3002`)

### Pascal Editor (`experimental/pascal-editor/apps/editor`)

- `NEXT_PUBLIC_BASE_PATH=/experimental/editor`

## Routing e sicurezza

- La voce menu `Experimental` e la pagina `/experimental` sono `tecmaAdminOnly`.
- Utenti non Tecma admin ricevono pagina `Accesso negato`.
- L’editor rimane separato per contenere il bundle del FE principale.

## Deploy (path-based)

Configurare il reverse proxy del frontend pubblico in modo che:

- `/experimental/editor` e `/experimental/editor/*` -> servizio Pascal Editor
- tutto il resto -> Followup frontend

Esempio logico (provider-agnostico):

- Route 1 (prioritaria): `^/experimental/editor(/.*)?$` -> `pascal-editor-service`
- Route 2 (fallback): `/*` -> `followup-fe-service`

Per il servizio `pascal-editor-service`:

- Build command: `bun install && bun run build`
- Start command: `bun run --cwd apps/editor start`
- Env: `NEXT_PUBLIC_BASE_PATH=/experimental/editor`

