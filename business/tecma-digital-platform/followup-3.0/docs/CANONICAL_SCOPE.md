# Ambito canonico Followup 3.0

## Source of truth

Lo sviluppo attivo di **Followup 3.0** avviene sotto questa cartella:

- `followup-3.0/be-followup-v3` — backend
- `followup-3.0/fe-followup-v3` — frontend
- `followup-3.0/mcp-followup` — server MCP di supporto

Audit di sicurezza, test e CI documentati per “Followup 3.0” si intendono riferiti a **questo albero**, salvo esplicita estensione di scope.

## Alberi paralleli nel monorepo

Nel repository `tecma-digital-platform` possono esistere percorsi storici o duplicati (es. copie sotto `be-tecma/` o `tecma-fe-apps/`). Non fanno parte automaticamente dello stesso audit finché il team non dichiara un allineamento o una migrazione completata.

Per riesaminare altri percorsi, indicare esplicitamente il path nel ticket o nella richiesta di review.

### Tabella di scope (riferimento operativo)

| Percorso (esempi) | Ruolo dichiarato | In scope audit / CI “Followup 3.0” |
|---------------------|------------------|-------------------------------------|
| `followup-3.0/be-followup-v3` | Backend canonico | Sì — `ci-be.yml`, OpenAPI, route-guards, test core/integration |
| `followup-3.0/fe-followup-v3` | Frontend canonico | Sì — `ci-fe.yml`, bundle budget, E2E core |
| `followup-3.0/mcp-followup` | MCP di supporto | Sì solo se incluso esplicitamente nel ticket; CI dedicata assente di default |
| `be-tecma/`, `tecma-fe-apps/`, altri alberi fuori `followup-3.0/` | Legacy / altri prodotti | **No** — non coperti da `ci-be.yml` / `ci-fe.yml` del followup-3.0; richiedono scope esplicito e workflow propri |

Se un servizio in produzione non coincide con le righe “Sì”, aprire un task di allineamento (migrazione verso `followup-3.0/*` o estensione CI con path e comandi dedicati).
