# Followup Future - AI Native CRM Plan

> **Deprecato.** La direzione AI ed evoluzioni sono in **[FOLLOWUP_3_MASTER.md](FOLLOWUP_3_MASTER.md)** (Wave 7 e sezione Visione). Conservato per riferimento storico.

## Product Direction
- Core CRM stabile e veloce: clienti, appartamenti, associazioni, calendario, preventivi.
- AI Layer trasversale: suggerimenti, drafting, priorita giornaliera, automazioni approvabili.
- Services Layer attivabile per cliente: moduli custom senza impattare il core.
- MCP Layer per agenti esterni (Codex/Claude) con controlli RBAC e audit.

## UX Vision (Next-Gen)
- Cockpit operativo unico: "Cosa richiede attenzione oggi".
- Command Palette globale: azioni da tastiera + prompt.
- Timeline unificata cliente/trattativa con eventi umani + AI + sistema.
- Views multi-modello: tabella, kanban, signal board, calendario.
- Ogni insight deve avere CTA immediata: Esegui / Approva / Delega.

## Technical Direction
- Frontend: React + Vite + REST adapters + cache invalidation mirata.
- Backend: REST modulare (`clients`, `apartments`, `calendar`, `workflows`, `ai`, `services`).
- Event backbone: eventi dominio (`client.created`, `deal.stage.changed`, `meeting.scheduled`).
- AI Orchestrator: input eventi + contesto -> suggerimenti/azioni.
- Rules Engine separato dall'AI per compliance e prevedibilita.

## MCP Server (Dedicated Repo)
- Repo: `mcp-followup`.
- Tools v1:
  - `search_clients`
  - `create_task`
  - `schedule_meeting`
  - `change_deal_stage`
  - `generate_workspace_report`
- Guardrail:
  - scope per workspace/project
  - dry-run default su azioni a impatto
  - human approval per bulk o cambi stato critici
  - audit log obbligatorio

## Services SDK
- Contratto service:
  - `manifest.json` (slug, version, permissions, nav entries)
  - endpoint REST namespaced `/v1/services/:slug/*`
  - frontend entrypoint per route/addon panel
- Billing model:
  - Core in licenza
  - Services come upsell modulare

## Execution Roadmap
1. Stabilizzare UX parity delle 7 pagine HC/workflow (in corso, pagina per pagina).
2. Introdurre Command Palette + quick actions cross-modulo.
3. Implementare Cockpit AI "Today" con ranking priorita.
4. Esporre eventi dominio + primi automation hooks.
5. Bootstrap `mcp-followup` con 3 tool read + 2 tool write.
6. Portare il primo service AI-native (reminder + follow-up automation).

## Immediate Next Slice
- Finire parity pagina "Modifica Appartamento HC".
- Poi "Associa Apt/Cliente" in versione action-first.
- Poi "Configura Flusso Completo" come wizard enterprise con preview step-by-step.
