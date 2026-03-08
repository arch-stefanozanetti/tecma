# Followup 3.0 - Mega CRM Futuristico (Master Plan Completo)

> **Deprecato.** La visione e i principi sono stati sintetizzati in **[FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md)**. Non usare questo file come fonte di verità; conservato per riferimento storico.

## 1. North Star
Costruire un CRM multiprogetto AI-native che sia:
- più rapido dei CRM classici nelle operazioni quotidiane
- estremamente intuitivo per utenti non tecnici
- estendibile con servizi custom senza degradare il core
- governabile e sicuro per automazioni AI e agenti esterni

## 2. Product Pillars
- Core CRM: clienti, appartamenti, associazioni, preventivi, attività, calendario.
- AI Layer: suggerimenti operativi, priorità, drafting, automazioni approvabili.
- Services Layer: addon verticali attivabili per cliente/workspace.
- MCP Layer: interfaccia tool-based per agenti (Codex/Claude) con audit.

## 3. Experience Model (differenziante)
- Cockpit Today: feed unico “cosa richiede attenzione adesso”.
- Command Palette + Prompt Bar: azioni da tastiera e linguaggio naturale.
- Timeline Unificata: eventi utente + sistema + AI su cliente/deal/progetto.
- Action Cards: ogni insight deve avere CTA immediata (Esegui/Approva/Assegna).
- Adaptive Views: tabella, kanban, calendario, signal board (stesso dataset).

## 4. Domain Model Unificato
- Workspace (cliente broker/agency)
  - Projects[]
    - Clients[]
    - Apartments[]
    - Deals/Quotes[]
    - Activities[]
    - CalendarEvents[]
- User con scope su workspace/projectIds
- ServicesRegistry per addon attivi e permessi
- EventLog append-only per tracciabilità AI e automazioni

## 5. Architettura Tecnica Target
### Frontend
- React + Vite + TypeScript strict
- REST adapters + cache invalidation mirata
- Design system coerente (layout, motion, tokens)
- Shell modulare: core modules + service mounts

### Backend
- REST modulare (modular monolith iniziale):
  - `auth`
  - `workspaces`
  - `clients`
  - `apartments`
  - `deals`
  - `calendar`
  - `workflows`
  - `services`
  - `ai`
- MongoDB source of truth
- Event bus interno (dominio)
- OpenAPI come contratto ufficiale

### AI + Rules
- Rules Engine deterministico (policy business)
- AI Orchestrator (suggest/assist/execute con policy)
- Human-in-the-loop su azioni ad alto impatto

### MCP
- Repo dedicata `mcp-followup`
- Tool tipizzati con:
  - RBAC
  - scope workspace/project
  - dry-run
  - audit log

## 6. API Strategy (REST-first)
- Contratto query standard:
  - request: `workspaceId`, `projectIds[]`, `page`, `perPage`, `searchText`, `sort`, `filters`
  - response: `data[]`, `pagination`
- Error model standard:
  - 400 validation
  - 401/403 auth/scope
  - 404 not found
  - 409 conflict business
  - 500 unexpected
- Versioning:
  - `/v1/*` stabile
  - breaking changes in `/v2/*`

## 7. Security & Governance
- JWT + scope claims per workspace/project
- Secrets solo via env manager (mai hardcoded)
- Audit obbligatorio su write operations sensibili
- Rate limits su endpoint AI/MCP
- PII minimization + log redaction

## 8. Performance Targets (SLO)
- P95 query list principali < 350ms (dev target)
- P95 mutation principali < 500ms
- Cold start page critica < 2.5s
- Error rate API < 1%

## 9. Delivery Roadmap (12 settimane)
### Wave 1 - Foundation (W1-W3)
- Stabilizzare core REST + OpenAPI base
- Hardening auth/scope multiprogetto
- Uniformare list/query pattern su moduli core
- UI parity delle pagine critiche legacy

### Wave 2 - Operational Excellence (W4-W6)
- Cockpit Today v1
- Timeline unificata cliente/trattativa
- Command Palette con quick actions
- Workflow completo enterprise (preview/execute robusto)

### Wave 3 - AI Native (W7-W9)
- AI suggestions v1 (solo suggest, no auto-write)
- Lead/deal scoring e risk signals
- Drafting email/reminder contestuale
- Action approvals inline

### Wave 4 - Platform & Scale (W10-W12)
- Services SDK v1 (manifest, route mount, permissions)
- Primo addon AI-native in produzione
- MCP server v1 (5 tool principali)
- Audit dashboard + usage analytics

## 10. Backlog Macro per stream
### Stream FE
- Shell unificata moderna
- moduli core completi
- cockpit + signal board
- prompt/command UX

### Stream BE
- refactor endpoint per bounded context
- ottimizzazione aggregazioni mongo
- event emission centralizzata
- openapi completa

### Stream AI
- orchestrator
- policies & approvals
- ranking engine priorità

### Stream Platform
- service loader/contracts
- mcp server
- audit & observability

## 11. KPI di Successo Prodotto
- Time-to-action medio utente (target -40%)
- Conversione proposta->compromesso (target +15%)
- Riduzione attività manuali ripetitive (target -35%)
- Adozione command/prompt (target > 50% utenti attivi)
- Churn core licenze (target in diminuzione)

## 12. Operating Model
- Sprint settimanali con demo live
- Release train quindicinale
- Feature flags per AI/services
- Quality gates:
  - test integrazione API
  - e2e percorsi critici
  - performance smoke

## 13. Rischi principali e mitigazioni
- Drift UX tra moduli: design tokens + component contracts.
- Complessità AI prematura: rollout graduale suggest-first.
- Debito tecnico legacy: strangler pattern modulo per modulo.
- Personalizzazioni invasive: Services SDK isolato dal core.

## 14. Prossime 3 mosse operative (immediate)
1. Congelare il contratto API `/v1` per moduli core già toccati.
2. Costruire Cockpit Today v1 con dataset reale multiprogetto.
3. Avviare repo `mcp-followup` con tool read-only iniziali + audit.
