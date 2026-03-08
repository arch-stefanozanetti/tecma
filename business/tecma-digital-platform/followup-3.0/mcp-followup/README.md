# mcp-followup

MCP bridge server for Followup 3.0.

## Tools (read-only v1)
- `search_clients`
- `search_apartments`
- `list_associations`
- `generate_workspace_report`

## Security
- Requires `x-api-key` header matching `MCP_API_KEY`.
- Every tool call is logged to `logs/audit.log`.

## Run
```bash
npm install
cp .env.example .env
npm run dev
```

Server default: `http://localhost:5070`.
