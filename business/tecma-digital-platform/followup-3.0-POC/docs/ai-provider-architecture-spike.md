# Spike / architettura: provider AI e MCP (FollowUp 3.0)

Documento di decisione **indipendente** dal MVP post-vendita; allinea prodotto e sicurezza prima di implementare configurazioni reali o endpoint `/v1/ai/...`.

## 1. Segreti e workspace

- Le **API key** (Anthropic, OpenAI, Azure, Mistral, Google, ecc.) devono essere memorizzate **per workspace** lato **backend**, mai in localStorage/sessione FE o in bundle client.
- Allineamento al pattern degli altri connettori: cifratura at-rest dove già previsto, mascheramento in UI, rotazione su richiesta.
- Permessi: in linea con **RBAC** esistente (es. `integrations.update` o permesso dedicato quando introdotto) per leggere/modificare la configurazione AI.

## 2. Proxy completion (opzione consigliata)

- Esporre un **unico ingresso applicativo** (es. `POST /v1/ai/completions` o route per assistente dominio) che:
  - autentica l’utente e verifica accesso al workspace;
  - applica **rate limit** per utente/workspace;
  - inoltra la richiesta al provider scelto usando la chiave server-side;
  - registra **audit** (chi, workspace, modello, timestamp; non loggare prompt completi se policy lo vieta).
- Il **frontend** non chiama mai direttamente `api.anthropic.com`, `api.openai.com`, ecc.

## 3. MCP vs API REST

| Aspetto | API REST provider (Anthropic/OpenAI/…) | MCP (Model Context Protocol) |
|--------|----------------------------------------|------------------------------|
| Ruolo | Completamenti e chat verso modelli | Protocollo **host ↔ server di tool** (azioni, contesto) |
| In prodotto | Primo passo naturale: proxy + policy | Integrazione con **n8n**, job backend, o ambienti dedicati; non è configurazione «logo» senza infrastruttura |
| Segreti | Chiavi provider nel backend | Oltre alle chiavi, gestione **tool** e permessi sui dati Tecma |

**Decisione:** trattare MCP come **capability avanzata** (bridge verso orchestrazione), non come sostituto del dominio immobiliare; documentazione utente già presente in catalogo connettori «MCP server / tool bridge».

## 4. CLI (Claude Code, altre)

- Strumenti per **sviluppo / ops** o **partner tecnici**, non obiettivo del wizard self-service nel portale per l’utente business standard.
- Il catalogo distingue **API Anthropic** da «CLI / ambienti locali» nelle note.

## 5. Prossimi passi (fuori da questo spike)

- Definire schema storage `tz_workspace_ai_*` o estensione connettori esistente.
- OpenAPI per endpoint proxy quando il gateway sarà allineato.
- Test carico e limiti budget per workspace.
