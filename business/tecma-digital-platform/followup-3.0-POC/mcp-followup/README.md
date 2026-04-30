# mcp-followup

Bridge MCP che espone tool (search_clients, search_apartments, list_associations, generate_workspace_report) chiamando il backend Followup.

## Configurazione

- **FOLLOWUP_API_BASE_URL**: base URL del backend (default `http://localhost:8080/v1`). Il backend documentato usa porta 8080.
- **MCP_API_KEY**: chiave richiesta nell’header `x-api-key` per le richieste ai tool (default `change-me`).
- **FOLLOWUP_BEARER_TOKEN** o **MCP_BEARER_TOKEN**: token JWT inviato al backend come `Authorization: Bearer <token>`. Gli endpoint `/clients/query`, `/apartments/query`, `/associations/query` sono protetti: senza token le chiamate falliranno con 401. Impostare uno dei due env con un token valido (es. ottenuto da login sul BE).

## Script

- `npm run dev` – avvio in watch
- `npm run build` – build TypeScript
- `npm start` – avvio da dist
- `npm run lint` – ESLint su `src`
- `npm run test` – test (health, tools list, validazione body)
