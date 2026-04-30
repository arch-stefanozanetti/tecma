# Twilio in Followup vs Twilio MCP in Cursor

## Followup invia davvero a Twilio?

**Sì**, quando la configurazione workspace è presente e valida. Il backend (`be-followup-v3`) chiama l’API REST Twilio **Messages** (WhatsApp) con `POST` reale; non è uno stub UI.

Se “sembra non funzionare”, controlla tipicamente:

- **Credenziali / sender** non salvati o errati nel connettore workspace.
- **Sandbox WhatsApp** Twilio: il destinatario deve aver accettato l’invito sandbox o usare numeri/prodotti idonei.
- **Formato numeri**: il servizio normalizza `whatsapp:` su From/To dove serve; verifica che il template/canale sia coerente con ciò che Twilio accetta per il tuo account.

Per una prova controllata da admin: endpoint di test documentato in `README.md` del progetto (Integrazioni / connettori).

## Cos’è `@twilio-alpha/mcp`?

È un **server MCP** ufficiale in alpha che espone le **API Twilio** al client MCP (es. Cursor). Permette all’assistente nell’IDE di **consultare o invocare tool Twilio** (secondo i servizi/tag che abiliti).

**Non sostituisce** il bridge **Followup REST ↔ `mcp-followup`**: sono due canali diversi:

| Cosa | Ruolo |
|------|--------|
| **Followup BE + connettori** | Invio messaggi e logica prodotto nel tuo tenant/workspace. |
| **Twilio MCP in Cursor** | Automazione/sviluppo contro Twilio dall’IDE (debug, esplorazione API). |

## Configurazione consigliata in Cursor

Aggiungi il server nelle impostazioni MCP di Cursor (file utente o progetto, **mai** con segreti in git).

### Esempio (placeholder)

```json
{
  "mcpServers": {
    "twilio": {
      "command": "npx",
      "args": [
        "-y",
        "@twilio-alpha/mcp",
        "YOUR_TWILIO_ACCOUNT_SID/YOUR_TWILIO_API_KEY:YOUR_TWILIO_API_SECRET",
        "--services",
        "twilio_api_v2010",
        "--tags",
        "Api20100401IncomingPhoneNumber"
      ]
    }
  }
}
```

- Sostituisci `YOUR_*` con **Account SID** e coppia **API Key / API Secret** dalla console Twilio (non committare mai valori reali).
- `--services` e `--tags` limitano gli endpoint esposti (meno superficie, caricamento più veloce). Allarga i tag se ti servono altre risorse (es. Messaging).

### Sicurezza

- **Non** incollare SID/secret in repository o issue.
- Preferisci dove possibile variabili d’ambiente o secret manager supportati dal client MCP (se la tua versione di Cursor lo consente per `env`).
- Pacchetto in **alpha**: valuta aggiornamenti e policy Twilio prima dell’uso in produzione su account sensibili.

## Riferimenti

- NPM: [`@twilio-alpha/mcp`](https://www.npmjs.com/package/@twilio-alpha/mcp)
- Blog Twilio: introduzione al server MCP (cerca “Twilio Alpha MCP” sul blog ufficiale).
