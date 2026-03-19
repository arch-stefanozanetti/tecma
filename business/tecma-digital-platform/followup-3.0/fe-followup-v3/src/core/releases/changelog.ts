/**
 * CHANGELOG Followup 3.0
 *
 * CONVENZIONE DI AGGIORNAMENTO:
 * - Ogni volta che si implementa una o più feature, aggiungere una nuova entry IN CIMA a questo array.
 * - Aggiornare anche `version` in `package.json` (FE) e in `be-followup-v3/package.json` (BE) con lo stesso numero.
 * - Usare versionamento semver:
 *   - PATCH (0.x.Y+1): bug fix, correzioni UI, piccoli aggiustamenti
 *   - MINOR (0.X+1.0): nuove funzionalità retrocompatibili
 *   - MAJOR (X+1.0.0): breaking change, ristrutturazioni architetturali
 *
 * TIPI DI VOCE:
 *   feature     → nuova funzionalità
 *   improvement → miglioramento di funzionalità esistente
 *   fix         → correzione di bug o comportamento errato
 *   breaking    → breaking change
 */

export type ChangeType = "feature" | "improvement" | "fix" | "breaking";
export type ReleaseType = "major" | "minor" | "patch";

export interface ChangelogChange {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  releaseType: ReleaseType;
  changes: ChangelogChange[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.13.1",
    date: "2026-03-18",
    title: "Calendario, release notes e deploy",
    releaseType: "patch",
    changes: [
      {
        type: "fix",
        text: "Calendario: l'appuntamento creato ora compare subito in vista (aggiornamento ottimistico + refetch); il backend salva correttamente in calendar_events.",
      },
      {
        type: "improvement",
        text: "Release notes: convenzione aggiornata — aggiornare sempre changelog.ts (e version in package.json FE/BE) a ogni release; regola in .cursor/rules per l'agente.",
      },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-03-06",
    title: "Connettori reali (n8n, Outlook, Looker) e Communication Engine — Touchpoint multicanale",
    releaseType: "minor",
    changes: [
      // Connettori reali
      {
        type: "feature",
        text: "Webhook: aggiunto connectorId a WebhookConfig per distinguere configurazioni per connettore (n8n, Outlook, ecc.).",
      },
      {
        type: "feature",
        text: "n8n: configurazione per workspace (base URL, API key, workflow ID default) in tz_connector_configs; servizio trigger workflow via POST API n8n; route GET/POST config e POST trigger; integrazione con eventi CRM (stesso payload dei webhook).",
      },
      {
        type: "feature",
        text: "Integrazioni: drawer configurazione n8n (Base URL, API key, Workflow ID) e Looker (test API listati); stato connettori derivato da webhook config e localStorage dove applicabile.",
      },
      {
        type: "feature",
        text: "Outlook: OAuth2 Microsoft + Microsoft Graph per calendario; servizio auth/callback, refresh token, GET eventi calendario; route auth, callback, calendar/events, DELETE disconnessione; FE \"Connetti Outlook\" / \"Disconnetti\" e vista eventi calendario Outlook.",
      },
      {
        type: "feature",
        text: "Looker Studio: endpoint GET /v1/public/listings con query params (workspaceId, projectIds, page, perPage); documentazione API; codice Community Connector (Google Apps Script) e README per uso in Looker.",
      },
      // Communication Engine
      {
        type: "feature",
        text: "Communication Engine: catalogo eventi esteso (visit.scheduled, visit.updated, visit.completed, proposal.sent, contract.signed) emessi da calendario e trattative.",
      },
      {
        type: "feature",
        text: "Template e regole di comunicazione: collection tz_communication_templates e tz_communication_rules; azioni send_email, send_whatsapp, send_sms, create_notification; variabili {{client_name}}, {{apartment_name}}, {{visit_date}}, ecc.; risoluzione contesto da payload evento.",
      },
      {
        type: "feature",
        text: "Email: modulo SMTP (Nodemailer, env SMTP_*); channel dispatcher unico per email, WhatsApp, in-app; integrazione regole comunicazione nel dispatch eventi.",
      },
      {
        type: "feature",
        text: "WhatsApp: configurazione per workspace (Twilio) in tz_connector_configs; whatsapp.service per invio messaggi; tab Comunicazioni con form Account SID, Auth Token, From Number.",
      },
      {
        type: "feature",
        text: "UI Comunicazioni: tab in Integrazioni con lista template, lista regole di comunicazione, configurazione canali (WhatsApp) e log invii.",
      },
      {
        type: "feature",
        text: "Comunicazioni schedulate: collection tz_scheduled_communications; creazione job alla visit.scheduled in base a regole con schedules (offset in ore/giorni); worker ogni 2 minuti che invia le comunicazioni in scadenza.",
      },
      {
        type: "feature",
        text: "Branding progetto: collection tz_project_branding (logoUrl, primaryColor, footerText); layout email con logo, bordo colore e footer; API GET/PUT /projects/:id/branding; sezione \"Branding (email e comunicazioni)\" in configurazione progetto.",
      },
      {
        type: "feature",
        text: "Notification Center: log invii in tz_communication_deliveries (canale, destinatario mascherato, stato, data); API GET communication-deliveries; sezione \"Ultime comunicazioni\" nel tab Comunicazioni.",
      },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-03-10",
    title: "Integrazioni e automazioni funzionanti — Notifiche, Regole, Webhook",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "Notifiche backend: collection tz_notifications, API GET/PATCH/POST notifiche; Inbox funziona end-to-end con dati reali.",
      },
      {
        type: "feature",
        text: "Regole di automazione: CRUD backend (tz_automation_rules), dispatch eventi su request.created, request.status_changed, client.created; azione crea notifica; tab Regole con lista e drawer crea/modifica.",
      },
      {
        type: "feature",
        text: "Webhook: CRUD backend (tz_webhook_configs), invio payload su eventi con retry e firma HMAC; tab Webhook con lista e drawer crea/modifica.",
      },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-03-10",
    title: "CRM nuovo millennio — Inbox, Customer 360, Automazioni",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "Inbox: icona campanella in header con badge non letti; drawer notifiche con lista, link e azione \"Segna tutti come letti\". API GET /notifications collegata (v. 0.12.0).",
      },
      {
        type: "feature",
        text: "Customer 360: nella scheda cliente nuova sezione Timeline unificata (richieste, azioni trattative, eventi calendario) ordinata per data.",
      },
      {
        type: "feature",
        text: "Automazioni e API: pagina placeholder in Strumenti per regole if/then e webhook; documentazione API pubbliche in docs.",
      },
      {
        type: "improvement",
        text: "Integrazioni e automazioni unificate: una sola voce di menu e route /integrations con tab Connettori | Regole | Webhook | API; redirect da /automations a /integrations?tab=regole.",
      },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-03-09",
    title: "CRM nuovo millennio Wave 1 — Ricerca globale e preferenze UX",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "Command palette (Cmd/Ctrl+K): ricerca su clienti, appartamenti e trattative oltre alla navigazione tra sezioni; navigazione diretta al dettaglio da risultato.",
      },
      {
        type: "feature",
        text: "Preferenze UX: stato sidebar collassata persistito in localStorage per workspace.",
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-03-08",
    title: "Compravendita, Matching, Azioni, Integrazioni, Progetti",
    releaseType: "minor",
    changes: [
      // Compravendita
      {
        type: "feature",
        text: "Compravendita: voce \"Associa Apt/Cliente\" aggiunta alla navbar principale per accesso diretto al flusso proposta → compromesso → rogito.",
      },
      {
        type: "feature",
        text: "Trattative: quando una trattativa va in stato \"Vinto\" con appartamento associato, compare il pulsante \"Crea associazione proposta\" che pre-compila il form di compravendita.",
      },
      {
        type: "improvement",
        text: "AssociateAptClientPage accetta parametri iniziali (clientId, apartmentId, status) passati via route state per precompilazione da altre sezioni.",
      },
      // Matching
      {
        type: "feature",
        text: "Matching: nuovi endpoint GET /v1/matching/apartments/:id/candidates e GET /v1/matching/clients/:id/candidates con algoritmo di scoring basato su budget, prezzo e città.",
      },
      {
        type: "feature",
        text: "Scheda Appartamento: nuovo tab \"Clienti papabili\" con lista clienti compatibili e score 0-100.",
      },
      {
        type: "feature",
        text: "Scheda Cliente: sezione \"Appartamenti papabili\" con lista appartamenti disponibili compatibili e score 0-100, sostituisce il placeholder statico precedente.",
      },
      // Azioni cliente
      {
        type: "feature",
        text: "Azioni cliente: nuovi pulsanti in scheda cliente — Mail ricevuta, Mail inviata, Chiamata fatta, Meeting fissato — che registrano l'azione in tz_client_actions e nell'audit log.",
      },
      {
        type: "feature",
        text: "Backend: nuovo service actions.service.ts con collection tz_client_actions e route POST /v1/clients/:clientId/actions.",
      },
      // Fix UI
      {
        type: "fix",
        text: "Appartamento: il pulsante \"Modifica\" nella scheda dettaglio ora apre un form per dati base (codice, nome, stato, superficie) invece di rimandare erroneamente alla configurazione HC.",
      },
      {
        type: "improvement",
        text: "Appartamento: aggiunto pulsante separato \"Configura HC\" per la configurazione Home Configuration, distinto dalla modifica dati base.",
      },
      {
        type: "improvement",
        text: "Cliente: il form di modifica usa il Drawer del design system (pannello laterale scorrevole) in linea con il resto dell'app.",
      },
      {
        type: "fix",
        text: "Clienti: il click su una riga della lista ora apre lo Sheet di preview (anteprima laterale) invece di navigare direttamente alla scheda dettaglio.",
      },
      // Integrazioni
      {
        type: "feature",
        text: "Integrazioni: nuova pagina catalogo connettori con 9 integrazioni (Gmail, Outlook, Mailchimp, n8n, Salesforce, Webflow, Looker Studio, DocuSign, Slack), ricerca e filtro per gruppo.",
      },
      {
        type: "feature",
        text: "Integrazioni: voce \"Integrazioni\" aggiunta in navbar, protetta da feature flag \"integrations\" per workspace.",
      },
      // Progetti
      {
        type: "feature",
        text: "Progetti: nuova pagina lista progetti del workspace corrente, accessibile dalla navbar a tutti gli utenti (non solo admin).",
      },
      {
        type: "feature",
        text: "Progetto: la scheda di configurazione è ora completamente editabile — Identità, Contatti e URL, Note legali e privacy, Configurazione tecnica (hostKey, assetKey, feVendorKey, feature flags), Email, Template PDF.",
      },
      {
        type: "feature",
        text: "Note legali: nuovo campo dedicato \"Note legali\" (distinto da URL privacy policy e termini) per inserire disclaimer e avvertenze legali da mostrare ai clienti.",
      },
      {
        type: "feature",
        text: "Backend: nuovo endpoint PATCH /v1/projects/:projectId per aggiornare tutti i campi di un progetto.",
      },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-03-07",
    title: "API Gateway, Wave 6 — Hardening auth e DB unificato",
    releaseType: "minor",
    changes: [
      {
        type: "improvement",
        text: "Rimossi tutti i riferimenti ai DB legacy (project, client, asset) dal backend e frontend — il sistema usa esclusivamente il main DB (tz_*) e lettura legacy in sola lettura dove necessario.",
      },
      {
        type: "feature",
        text: "Seed test workspace: 6 progetti (4 originali + 2 clone), 8 trattative, eventi calendario, associazioni, audit log e domain events per testing completo.",
      },
      {
        type: "improvement",
        text: "Trattative: UI con vista lista e kanban, gestione transizioni di stato, form nuova trattativa con selezione cliente e appartamento.",
      },
      {
        type: "feature",
        text: "Workspace: gestione completa workspace + associazione progetti + gestione utenti e ruoli (vendor, vendor_manager, admin) via Drawer DS.",
      },
      {
        type: "feature",
        text: "Audit log: pagina dedicata con filtri per entità, tipo azione e data; export CSV.",
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-03-05",
    title: "Wave 5 — API riusabili e Report engine",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "API riusabili: endpoint listings (POST /v1/apartments/query pubblico senza JWT) e lista light clienti (POST /v1/clients/lite/query) per siti web, preventivatori e connettori esterni.",
      },
      {
        type: "feature",
        text: "Report: pagina /reports con pipeline async run/artifact, export CSV/XLSX/PDF, storage locale dev e audit base.",
      },
      {
        type: "feature",
        text: "Report operativo: metriche pipeline trattative, clienti per stato, appartamenti per disponibilità con drilldown filtrabile.",
      },
      {
        type: "feature",
        text: "Share link: link temporaneo pubblico per report con TTL e revoca.",
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-03-02",
    title: "Wave 4 — Requests/Deals e Calendario enterprise",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "Trattative (Requests/Deals): entità first-class con pipeline new→contacted→viewing→quote→offer→won/lost, gestione rent e sell, ruolo cliente (acquirente/venditore/affittuario/cedente).",
      },
      {
        type: "feature",
        text: "Associazioni cliente-appartamento: flusso proposta→compromesso→rogito, rilevamento conflitti e downgrade.",
      },
      {
        type: "feature",
        text: "Calendario: vista day/week/month/agenda con filtri per progetto, form evento completo, integrazione con cockpit.",
      },
      {
        type: "improvement",
        text: "Cockpit: KPI trattative, eventi oggi, action cards con urgency (risk/opportunity/followup).",
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-02-25",
    title: "Wave 3 — UX core: cockpit, clienti, appartamenti",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "Cockpit home action-first: feed \"cosa fare oggi\" con prossimi appuntamenti, KPI e action cards prioritizzate.",
      },
      {
        type: "feature",
        text: "Lista clienti: filtri avanzati, ricerca, Sheet anteprima con progressive disclosure, paginazione.",
      },
      {
        type: "feature",
        text: "Lista appartamenti: filtri per modalità (vendita/affitto) e stato, vista tabella, Sheet anteprima.",
      },
      {
        type: "feature",
        text: "Schede dettaglio: tabs Profilo, Trattative, Appartamenti, Timeline con audit log per cliente e appartamento.",
      },
      {
        type: "feature",
        text: "Command palette (Cmd+K): navigazione rapida a qualsiasi sezione.",
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-02-18",
    title: "Wave 2 — Design system e Tailwind",
    releaseType: "minor",
    changes: [
      {
        type: "improvement",
        text: "Design system: Tailwind come unica base di styling, token (colori, tipografia, spaziatura, radius), componenti in src/components/ui/.",
      },
      {
        type: "feature",
        text: "Componenti DS: Button, Input, Select, Dialog, Drawer, Sheet, Tabs, Badge, Card, Checkbox, FiltersDrawer, AppHeader.",
      },
      {
        type: "feature",
        text: "Regole design system (Figma MCP) in .cursor/rules/ per implementazioni coerenti.",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-02-10",
    title: "Wave 1 — Foundation e auth solida",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "Auth: login nativo (email + password) e SSO exchange, JWT Followup come identità principale.",
      },
      {
        type: "feature",
        text: "Multi-progetto: selezione workspace e progetti al login, persistenza in userPreferences (MongoDB).",
      },
      {
        type: "feature",
        text: "RBAC: scope JWT per workspace/projectIds, middleware auth, ruoli vendor/vendor_manager/admin.",
      },
      {
        type: "feature",
        text: "Backend modular monolith: REST /v1, OpenAPI, MongoDB main DB (tz_*), audit log su tutte le write operations.",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-01-28",
    title: "Architettura iniziale e scaffolding",
    releaseType: "minor",
    changes: [
      {
        type: "feature",
        text: "Stack: React + Vite + TypeScript strict (FE), Node + Express + TypeScript + MongoDB (BE).",
      },
      {
        type: "feature",
        text: "Monorepo followup-3.0 con fe-followup-v3 e be-followup-v3.",
      },
      {
        type: "feature",
        text: "CI: Vitest per unit/integration/coverage FE e BE, Playwright per E2E.",
      },
    ],
  },
];

/** Restituisce la versione corrente (prima entry del changelog). */
export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "0.0.0";
