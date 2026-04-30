/**
 * Catalogo funzionalità Followup 3.0 per generazione issue Jira (PRD operativo).
 * `FEATURE_CATALOG_INPUT` è authoring; `FEATURE_CATALOG` aggiunge kind (default product) e template PRD pieno.
 */
import type { AreaPrefix, CatalogRowInput, DisciplineId, FeatureCatalogEntry } from "./feature-catalog-types.js";
import { enrichRow } from "./feature-catalog-types.js";

export type {
  AreaPrefix,
  CatalogEntryKind,
  CatalogRowInput,
  CatalogWorkItemKind,
  DisciplineId,
  EpicId,
  FeatureCatalogEntry,
  PrdTemplate,
} from "./feature-catalog-types.js";
export { enrichRow, mergePrd } from "./feature-catalog-types.js";

const D = (fe: string, be: string, db: string, ux: string, qa: string, test: string): Record<DisciplineId, string> => ({
  frontend: fe,
  backend: be,
  database: db,
  uxUi: ux,
  qa: qa,
  test: test,
});

/** Base URL documentazione repo (path relativi alla root followup-3.0/docs) */
const docs = (path: string) => ({ label: path.split("/").pop() ?? path, href: path });

const FEATURE_CATALOG_INPUT: CatalogRowInput[] = [
  {
    idTema: "close-phase0",
    areaPrefix: "[Cross]",
    title: "Workspace, progetti utente, assignments, cockpit AI, platform API, matching",
    summary:
      "Offre workspace multipli, progetti visibili per utente, assegnazioni entità, cockpit con suggerimenti AI, API di piattaforma e matching candidati.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md"), docs("AI_FLOWS.md"), docs("API_RIUSABILI.md")],
    disciplines: D(
      "UI workspace (WorkspacesPage, ProjectAccess), cockpit PrioritySuggestionsList, accordion suggerimenti, link a clienti.",
      "Route workspace users, tz_workspace_user_projects, entity assignments, query clients/apartments filtrate, platform clients lite, matching routes, AI suggestions orchestrator.",
      "Collections tz_entity_assignments, tz_workspace_user_projects, tz_ai_suggestions; user.workspaces su documento utente.",
      "Flussi lineari per admin; progressive disclosure; messaggi se AI non configurata.",
      "Test permessi viewer vs admin; matching e platform API con scope; rigenerazione suggerimenti.",
      "Vitest su orchestrator e componenti cockpit; smoke E2E login → cockpit."
    ),
  },
  {
    idTema: "user-access-granularity",
    areaPrefix: "[Cross]",
    title: "RBAC granulare, wizard utenti, permission catalog, audit membership",
    summary:
      "Applica RBAC per modulo e azione, override per utente, catalogo permessi via API e audit su membership workspace e progetti.",
    docLinks: [docs("deliverables/FASE01_USER_ACCESS_RBAC.md"), docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Wizard 4 passi utenti, PermissionOverrideMatrix, PermissionGated su pagine e CTA, integrazioni in sola lettura se senza permesso.",
      "PERMISSIONS, requirePermission su route, GET permission-catalog, workspace-roles, PATCH users con override, audit eventi.",
      "tz_roleDefinitions reconcile; campi permessi su user in Mongo (test-zanetti).",
      "Matrice permessi comprensibile; etichette modulo/azione coerenti.",
      "Matrice permessi in staging; 403 su route sensibili; regressione liste.",
      "Test integrazione route-guards; E2E permessi su Clienti/Trattative/Appartamenti."
    ),
  },
  {
    idTema: "commercial-entitlements",
    areaPrefix: "[Cross]",
    title: "Entitlement commerciale vs RBAC (Twilio, Public API, Mailchimp/AC)",
    summary:
      "Attiva o disattiva moduli a pagamento per workspace; blocca route platform e invii senza entitlement; vetrina in FE e gestione in console Tecma.",
    docLinks: [docs("deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md"), docs("STAGING_ENTITLEMENTS_SMOKE.md")],
    disciplines: D(
      "Integrazioni: tab API, banner entitlement, drawer connettori, disabilitazione CTA.",
      "tz_workspace_entitlements, GET/PATCH entitlements, middleware enforcement platform e Twilio.",
      "Persistenza entitlement e audit PATCH.",
      "Copy vetrina e footnote per moduli disattivati.",
      "Checklist staging: 403 senza entitlement; audit visibile.",
      "Test manuali smoke entitlements; contract test su route platform."
    ),
  },
  {
    idTema: "tecma-activation-audit",
    areaPrefix: "[Cross]",
    title: "Console Tecma entitlements e tracciamento attivazioni",
    summary:
      "Consente alla console Tecma di consultare e aggiornare entitlement per workspace e note commerciali, con tracciamento modifiche.",
    docLinks: [docs("deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md")],
    disciplines: D(
      "TecmaEntitlementsPage, selettore workspace, form PATCH, lettura audit.",
      "Endpoint PATCH/GET entitlements, eventi dominio workspace.entitlement.updated.",
      "Documenti audit in collezioni esistenti secondo implementazione.",
      "Flusso Tecma admin chiaro; conferme su modifiche.",
      "Regressione console su staging.",
      "E2E riservata Tecma admin."
    ),
  },
  {
    idTema: "csv-mapping",
    areaPrefix: "[Cross]",
    title: "Migrazione dati legacy e mapping CSV verso il dominio operativo",
    summary:
      "Importa e allinea clienti, appartamenti e quote da export legacy verso le collezioni operative del dominio; supporta query e migrazione pilota.",
    docLinks: [docs("deliverables/FASE1_CSV_MAPPING.md"), docs("deliverables/PILOT_ETL_RUNBOOK.md")],
    disciplines: D(
      "Schermate o script UI per validazione campi post-migrazione se previste.",
      "Endpoint quotes/query, servizi mapping, ETL idempotente.",
      "tz_clients, tz_apartments, tz_quotes; indici e coerenza ID progetto/workspace.",
      "Messaggi errore e stati migrazione comprensibili.",
      "Confronto campionamenti post-migrazione; conteggi documentati.",
      "Test su dataset pilota; dry-run vs live documentati."
    ),
  },
  {
    idTema: "s3-verify",
    areaPrefix: "[Cross]",
    title: "Storage S3, presigned URL, diagnostica asset",
    summary:
      "Gestisce upload e download documenti su S3 con URL presigned e offre diagnostica per verificare bucket e permessi.",
    docLinks: [docs("deliverables/FASE3_S3_VERIFICATION.md"), docs("RENDER_DEPLOY.md")],
    disciplines: D(
      "Upload documenti cliente/asset dove previsto; link a diagnostica Tecma.",
      "assets-s3.service, route storage, GET diagnostica.",
      "Policy IAM; variabili bucket; lifecycle opzionale.",
      "Feedback errore upload chiaro.",
      "Checklist manuale staging IAM.",
      "Test integrazione upload (mock o staging)."
    ),
  },
  {
    idTema: "digital-quote",
    areaPrefix: "[Sell]",
    title: "Preventivo digitale, PDF, magic link pubblico",
    summary:
      "Crea offerte da trattativa, genera PDF su storage e pubblica una pagina raggiungibile con token (magic link).",
    docLinks: [docs("deliverables/FASE2_DIGITAL_QUOTE.md")],
    disciplines: D(
      "Flussi UI trattativa → quote, anteprima, invio link.",
      "createDigitalQuote, firma token, aggiornamento request, upload PDF.",
      "tz_quotes, token hash, collegamenti request.",
      "UX firma e scadenza link.",
      "Checklist QA staging deliverable FASE2.",
      "E2E flusso quote su staging."
    ),
  },
  {
    idTema: "reports-dashboards",
    areaPrefix: "[Cross]",
    title: "Report, definizioni persistite, condivisione snapshot",
    summary:
      "Consente definizioni report, preferiti, condivisione snapshot con link e audit degli accessi in lettura.",
    docLinks: [docs("deliverables/FASE4_REPORTS_DASHBOARDS.md"), docs("telemetry/KPI_AND_DASHBOARDS.md")],
    disciplines: D(
      "Pagina Report, preferiti, export CSV gated, UI share link.",
      "report-definitions, share-definition, snapshot, security audit lettura.",
      "tz_report_definitions, tz_report_snapshots, metriche realtime opzionali.",
      "Leggibilità KPI e filtri.",
      "Test permessi reports.export; audit snapshot.",
      "Test snapshot deterministici e link pubblico."
    ),
  },
  {
    idTema: "calendar-sync",
    areaPrefix: "[Cross]",
    title: "Calendario unificato e sync Outlook/Gmail",
    summary:
      "Mostra eventi legati a client e request; integra Outlook via OAuth in UI; Gmail e job in roadmap.",
    docLinks: [docs("deliverables/FASE5_CALENDAR_SYNC.md")],
    disciplines: D(
      "CalendarPage, merge eventi esterni, drawer, banner OAuth.",
      "Servizi Outlook, token, endpoint calendar/events.",
      "Persistenza eventi e mapping ID esterni.",
      "UX creazione/modifica evento e stati collegamento.",
      "Test sync su account di test; refresh token.",
      "E2E calendario e conflitti fuso orario."
    ),
  },
  {
    idTema: "connectors-ux",
    areaPrefix: "[Cross]",
    title: "Connettori e comunicazioni (Twilio, cataloghi, Mailchimp/AC)",
    summary:
      "Presenta connettori e automazioni in UI e abilita integrazioni esterne solo se coperte da entitlement.",
    docLinks: [docs("deliverables/FASE6_CONNECTORS_UX.md")],
    disciplines: D(
      "Card Twilio, tab comunicazioni, catalogo dummy RE.",
      "Route connectors/communications, webhook, automazioni.",
      "Log dispatch e configurazioni workspace.",
      "Onboarding connettore chiaro.",
      "Smoke invio e 403 entitlement.",
      "Test integrazione sandbox provider."
    ),
  },
  {
    idTema: "inbox-contract",
    areaPrefix: "[Cross]",
    title: "Inbox notifiche e preferenze",
    summary:
      "Definisce tipi di notifica, inbox con empty state e persistenza centralizzata delle notifiche in-app.",
    docLinks: [docs("deliverables/FASE7_INBOX_CONTRACT.md")],
    disciplines: D(
      "Inbox header, lista, link contesto, preferenze mute.",
      "Generazione notifiche da domini automation/calendar/request.",
      "tz_notifications; indicizzazione e retention.",
      "Priorità visiva e riduzione rumore.",
      "Test tipi evento e regressioni link.",
      "E2E inbox dopo eventi sintetici."
    ),
  },
  {
    idTema: "visual-parity",
    areaPrefix: "[iTd]",
    title: "Parità visiva rispetto al design system ITD",
    summary:
      "Avvicina progressivamente l’aspetto delle schermate al design system ITD usando token e componenti condivisi.",
    docLinks: [docs("deliverables/FASE8_VISUAL_PARITY.md"), docs("DESIGN_SYSTEM.md")],
    disciplines: D(
      "Rifiniture pagine e componenti vs ITD.",
      "Nessun cambio API obbligatorio; eventuali fix layout.",
      "N/A salvo contenuti dinamici.",
      "Checklist confronto schermate.",
      "Regression visual snapshot opzionale.",
      "Chromatic o screenshot compare se disponibile."
    ),
  },
  {
    idTema: "ux-mobile",
    areaPrefix: "[Cross]",
    title: "UX mobile (checklist per pagina)",
    summary:
      "Rende fruibili su schermi piccoli i flussi CRM critici (breakpoint, tabelle scrollabili, touch target e drawer).",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Breakpoint, tabelle scrollabili, drawer full screen.",
      "N/A.",
      "N/A.",
      "Touch target e leggibilità.",
      "Checklist pagina per pagina.",
      "Playwright viewport mobile."
    ),
  },
  {
    idTema: "refactor-api-layer",
    areaPrefix: "[Cross]",
    title: "Refactor API layer FE (client HTTP per dominio)",
    summary:
      "Suddivide il client HTTP in moduli per dominio per ridurre file monolitici e migliorare test senza mutare i contratti API.",
    docLinks: [docs("REFACTORING.md"), docs("fe-followup-v3/ARCHITECTURE.md")],
    disciplines: D(
      "Split followupApi per dominio; hook condivisi.",
      "Nessun cambio contratto senza versionamento.",
      "N/A.",
      "N/A.",
      "Regression suite API client.",
      "Unit test parser risposte e errori."
    ),
  },
  {
    idTema: "matching-be",
    areaPrefix: "[Cross]",
    title: "Matching candidati appartamento/cliente",
    summary:
      "Espone API che propongono candidati tra clienti e unità con scoring e permessi di lettura coerenti col dominio.",
    docLinks: [docs("MATCHING.md"), docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "UI matching se esposta.",
      "matching.routes, scoring, permessi clients/apartments read.",
      "Indici per query matching.",
      "UX spiegazione punteggio.",
      "Dataset di test noti.",
      "Test integrazione matching."
    ),
  },
  {
    idTema: "auth-core",
    areaPrefix: "[Cross]",
    title: "Autenticazione, sessione, refresh, MFA, audit login",
    summary:
      "Consente login nativo o SSO, refresh token, logout e registrazione eventi di sicurezza sulle sessioni.",
    docLinks: [docs("FOLLOWUP_3_MASTER.md"), docs("AUTH_AUDIT_POLICY.md")],
    disciplines: D(
      "LoginPage, AccountSecurity, flussi MFA, storage token.",
      "auth routes, tz_authSessions, tz_authEvents, rate limit.",
      "Indici sessioni e revoca.",
      "Messaggi errore auth chiari.",
      "Test lockout e refresh.",
      "E2E login e logout."
    ),
  },
  {
    idTema: "clients-apartments-core",
    areaPrefix: "[Cross]",
    title: "Clienti e appartamenti (liste, schede, modello dati unificato)",
    summary:
      "Espone CRUD e liste su clienti e appartamenti con modelli di dominio allineati tra interfaccia e API.",
    docLinks: [docs("CLIENT_APARTMENT_MODEL.md")],
    disciplines: D(
      "ClientsPage, ApartmentsPage, sheet dettaglio, filtri.",
      "clients/apartments routes, validazione, permessi.",
      "Schema collections e indici liste.",
      "Progressive disclosure schede.",
      "Test filtri e permessi.",
      "E2E creazione cliente/appartamento."
    ),
  },
  {
    idTema: "requests-deals",
    areaPrefix: "[Cross]",
    title: "Trattative / Requests (rent + sell)",
    summary:
      "Gestisce trattative in vista kanban o lista con transizioni di stato coerenti sulle richieste commerciali.",
    docLinks: [docs("REQUESTS_MODEL.md")],
    disciplines: D(
      "RequestsPage, kanban, dettaglio sheet, azioni stato.",
      "requests routes, state machine, PATCH status.",
      "tz_requests indici workspace/progetto.",
      "UX stati e errori transizione.",
      "Test transizioni vietate.",
      "E2E flusso trattativa."
    ),
  },
  {
    idTema: "customer360",
    areaPrefix: "[Cross]",
    title: "Customer 360",
    summary:
      "Mostra una scheda cliente unificata con contesto operativo e link rapidi alle entità collegate (trattative, asset, ecc.).",
    docLinks: [docs("FOLLOWUP_3_MASTER.md"), docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Pagina Customer 360, tab, timeline, link.",
      "Aggregazione dati cliente + request + eventi.",
      "Letture ottimizzate; no N+1 eccessivi.",
      "Gerarchia informazioni e mobile.",
      "Test permessi clients/requests.read.",
      "E2E navigazione 360."
    ),
  },
  {
    idTema: "price-availability",
    areaPrefix: "[Cross]",
    title: "Prezzi e disponibilità",
    summary:
      "Gestisce listini, calendari prezzo/disponibilità e modelli commerciali collegati a cataloghi HC e inventario.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md"), docs("MAIN_DB_SCHEMA.md")],
    disciplines: D(
      "Pagina prezzi, editor listini, viste unità.",
      "Route HC/commercial models, calcolo prezzi, permessi settings.",
      "tz_sale_prices, tz_monthly_rents, tz_price_calendar, inventory.",
      "Chiarezza valute e date validità.",
      "Test regression su cambio listino.",
      "Test integrazione prezzi."
    ),
  },
  {
    idTema: "integrations-hub",
    areaPrefix: "[Cross]",
    title: "Integrazioni e automazioni (hub)",
    summary:
      "Centralizza regole di automazione, webhook e integrazioni marketing con configurazione e log eseguiti dal workspace.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md"), docs("REFACTORING.md")],
    disciplines: D(
      "IntegrationsPage tabs, catalogo, webhook UI.",
      "automation-rules, webhook-configs, marketing automation.",
      "Log e configurazioni persistenti.",
      "Flussi automazione comprensibili.",
      "Test invio webhook mock.",
      "E2E creazione regola."
    ),
  },
  {
    idTema: "big-data-marketing",
    areaPrefix: "[Cross]",
    title: "Big Data / Marketing (GA4, Ads, Meta)",
    summary:
      "Offre una pagina di integrazione dati marketing con OAuth, cache e diagnostica (es. GA4) per verificare la configurazione.",
    docLinks: [docs("runbooks/GA4_BIG_DATA_DIAGNOSI.md"), docs("MARKETING_APIS_RUNBOOK.md")],
    disciplines: D(
      "BigDataPage, banner configurazione, refresh cache.",
      "bigdata service, marketing OAuth, report GA4.",
      "tz_bigdata_cache fingerprint.",
      "Messaggi diagnostici e stato configured.",
      "Smoke con property di test.",
      "Test cache invalidation."
    ),
  },
  {
    idTema: "ai-cockpit-approvals",
    areaPrefix: "[Cross]",
    title: "AI — Cockpit, agente tool, Approvals",
    summary:
      "Mostra suggerimenti AI nel cockpit, consente esecuzione agente e gestione bozze con approvazioni umane nel loop.",
    docLinks: [docs("AI_FLOWS.md")],
    disciplines: D(
      "Cockpit, ApprovalsPage, execute suggestion, rigenera.",
      "Endpoint /v1/ai/*, tz_ai_suggestions, domain events.",
      "Retention suggerimenti; chiavi AI workspace.",
      "Flussi human-in-the-loop.",
      "Test senza LLM (AI_LLM_DISABLED).",
      "Vitest e integrazione agente mock."
    ),
  },
  {
    idTema: "platform-api-bss",
    areaPrefix: "[Cross]",
    title: "API platform, OpenAPI, TECMA-BSS gateway",
    summary:
      "Governance OpenAPI e merge delle specifiche verso il gateway TECMA-BSS con controlli su ciò che resta esposto.",
    docLinks: [docs("AUTH_AND_TECMA_BSS_API_REPORT.md"), docs("openapi-tecma-bss-additions.yaml")],
    disciplines: D(
      "Client FE verso BSS se applicabile.",
      "OpenAPI, merge spec, test governance.",
      "N/A.",
      "N/A.",
      "Validazione contratto.",
      "CI lint OpenAPI."
    ),
  },
  {
    idTema: "ci-quality-observability",
    areaPrefix: "[QA]",
    title: "CI/CD, test gates, osservabilità, sicurezza",
    summary:
      "Mantiene pipeline CI, gate di merge, osservabilità (log/trace) e runbook di sicurezza allineati al rilascio.",
    docLinks: [docs("CI_AND_TEST_GATES.md"), docs("SECURITY_RUNBOOK.md"), docs("OBSERVABILITY.md")],
    disciplines: D(
      "Badge stato build opzionale in UI interna.",
      "Workflow CI, gate merge, export audit.",
      "N/A.",
      "N/A.",
      "Pentest e checklist release.",
      "Test automatizzati copertura critica."
    ),
  },
  {
    idTema: "product-discovery",
    areaPrefix: "[Cross]",
    title: "Product Discovery",
    summary:
      "Raccoglie feedback e idee prodotto in un’area admin dedicata con priorità e tracciamento verso la roadmap.",
    docLinks: [docs("README.md")],
    disciplines: D(
      "ProductDiscoveryPage UX.",
      "API salvataggio discovery se presenti.",
      "Persistenza note/opportunità.",
      "Flusso PO chiaro.",
      "Test permessi admin.",
      "Smoke creazione item."
    ),
  },
  {
    idTema: "experimental-hub",
    areaPrefix: "[Cross]",
    title: "Area Experimental (Tecma admin)",
    summary:
      "Raggruppa funzioni sperimentali sotto route /experimental con accesso riservato agli admin Tecma.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "ExperimentalHubPage, gate Tecma.",
      "Route experimental backend.",
      "N/A.",
      "Avvisi su stabilità.",
      "Test solo Tecma admin.",
      "E2E limitati."
    ),
  },
  {
    idTema: "dialog-drawer-ux",
    areaPrefix: "[iTd]",
    title: "Pattern Dialog vs Drawer (residui)",
    summary:
      "Sostituisce progressivamente i dialog con drawer dove serve più contesto su liste e schede dettaglio.",
    docLinks: [docs("IMPLEMENTATION_TRACKER.md")],
    disciplines: D(
      "Sostituzione progressiva Dialog con Drawer.",
      "N/A.",
      "N/A.",
      "Coerenza motion e focus trap.",
      "Regression UI.",
      "Snapshot componenti."
    ),
  },
  {
    idTema: "ux-liste-card-toggle",
    areaPrefix: "[iTd]",
    title: "Liste Clienti/Appartamenti — card vs tabella",
    summary:
      "Consente di passare tra vista a card e tabella sulle liste principali, salvando la preferenza utente.",
    docLinks: [docs("IMPLEMENTATION_TRACKER.md")],
    disciplines: D(
      "Toggle persistenza preferenza utente.",
      "N/A.",
      "N/A.",
      "Leggibilità mobile.",
      "Test accessibilità.",
      "E2E toggle."
    ),
  },

  // --- Estensione catalogo: moduli espliciti be-followup-v3 / fe-followup-v3 (dettaglio operativo) ---
  {
    idTema: "keycloak-oidc-sso",
    areaPrefix: "[Cross]",
    title: "SSO Keycloak / OIDC callback e sessione",
    summary:
      "Consente il login tramite Identity Provider esterno (OIDC/Keycloak): dopo il callback allinea profilo utente, workspace e ambito progetti con l’app.",
    docLinks: [docs("AUTH_AND_TECMA_BSS_API_REPORT.md"), docs("FOLLOWUP_3_MASTER.md")],
    disciplines: D(
      "`KeycloakCallbackPage`, `getKeycloakCallbackPath`, redirect `backTo` via `postAuthRedirectHref` / `spaAbsolutePath` con `BASE_URL` deploy sotto prefisso.",
      "`auth.routes` + servizi token/SSO (`ssoJwtVerify`); validazione issuer/audience; mapping utente workspace; eventi `tz_authEvents` su primo accesso SSO.",
      "Documenti utente `user.workspaces`, sessioni `tz_authSessions`; indici su email + workspaceId per lookup rapido post-login.",
      "Messaggi errore SSO non tecnici; stato caricamento callback; niente token in URL persistente.",
      "Matrice staging: IdP di test, clock skew, revoca refresh; regressione login nativo vs SSO.",
      "E2E: callback simulato o ambiente IdP dedicato; test `spaPath` con `BASE_URL` non root.",
    ),
  },
  {
    idTema: "session-project-scope",
    areaPrefix: "[Cross]",
    title: "Sessione FE: ambito progetti, workspace e preferenze",
    summary:
      "Guida la scelta dei progetti visibili nella sessione (anche multipli), salva le preferenze e le riallinea quando cambia il workspace.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md"), docs("CLIENT_APARTMENT_MODEL.md")],
    disciplines: D(
      "`App.tsx` gating token + progetti selezionati; `filteredProjects` workspace tz; `onChangeWorkspace` hard reset scope; `CommandPalette` disabilitata senza progetti.",
      "`GET/POST` preferenze utente e `listWorkspaceProjects` per filtro progetti; coerenza `selectedProjectIds` vs lista server.",
      "Persistenza preferenze lato server; vincoli `tz_workspace` vs legacy workspace.",
      "UX: spiegare perché serve almeno un progetto prima della home; evitare loop navigazione.",
      "Test: utente con 0 progetti visibili; switch workspace con progetti diversi.",
      "E2E: login → ProjectAccess → cockpit con progetti multipli.",
    ),
  },
  {
    idTema: "clients-domain-detail",
    areaPrefix: "[Cross]",
    title: "Dominio Clienti — query, dettaglio, permessi lettura/scrittura",
    summary:
      "Liste e schede cliente con filtri per workspace e progetto; creazione e modifica condizionate dai permessi di lettura e scrittura.",
    docLinks: [docs("CLIENT_APARTMENT_MODEL.md")],
    disciplines: D(
      "`followupApi.clients.queryClients`, route `/clients/:clientId`; `PermissionGated` su dettaglio; form creazione e validazione campi PII.",
      "`clients.routes` + `clients.service`: validazione schema, filtri `ListQuery`, entity assignments per viewer.",
      "`tz_clients`: indici su workspaceId, projectId, `updatedAt`; proiezioni liste vs dettaglio; soft delete se previsto.",
      "Mascheramento dati sensibili per ruolo; empty state e ricerca debounced Command Palette.",
      "403/404 distinti; permessi granulari su PATCH; regression su export CSV se presente.",
      "Vitest client service; E2E lista → dettaglio → modifica campo.",
    ),
  },
  {
    idTema: "apartments-domain-detail",
    areaPrefix: "[Cross]",
    title: "Dominio Appartamenti — unità, codice, stato commerciale",
    summary:
      "Liste unità immobiliari e scheda dettaglio con collegamento a trattative e prezzi; supporta affitto e vendita e dati commerciali strutturati.",
    docLinks: [docs("CLIENT_APARTMENT_MODEL.md"), docs("REQUESTS_MODEL.md")],
    disciplines: D(
      "`ApartmentDetailPage`, filtri e ordinamenti lista; link a Customer 360 e Requests; UI stato immobile.",
      "`apartments.routes` + service: coerenza `projectIds`, lock trattativa se applicabile.",
      "Indici lista; campi derivati prezzo/disponibilità; relazione con `tz_requests` e quote.",
      "Copy coerente su stato (disponibile, riservato, venduto…); tooltip su vincoli modifica.",
      "Test permessi `apartments.read/create/update`; vincoli cross-progetto.",
      "E2E creazione appartamento e apertura dettaglio da ricerca Command Palette.",
    ),
  },
  {
    idTema: "requests-actions-workflow",
    areaPrefix: "[Cross]",
    title: "Trattative — azioni, workflow engine, lock appartamento",
    summary:
      "Azioni sulle trattative oltre al kanban: transizioni governate dal motore di workflow e blocco temporaneo dell’unità nelle operazioni critiche.",
    docLinks: [docs("REQUESTS_MODEL.md")],
    disciplines: D(
      "UI azioni rapide, stati e messaggi errore da API; integrazione Inbox e Calendar su cambio stato.",
      "`requests.routes`, `request-actions.service`, `workflow-engine.service`, `apartment-lock.service`.",
      "`tz_requests`, storico transizioni; documenti collegati; idempotenza azioni duplicate.",
      "Feedback immediato su lock/unlock; stati intermedi visibili.",
      "Property-based: transizioni vietate mai 500; lock concorrente.",
      "Test integrazione workflow + unit lock; E2E cambio stato end-to-end.",
    ),
  },
  {
    idTema: "calendar-events-domain",
    areaPrefix: "[Cross]",
    title: "Calendario — eventi interni, permessi dedicati e merge Outlook",
    summary:
      "Calendario con creazione e modifica eventi, integrazione fonti esterne e permessi dedicati; collega eventi a clienti e trattative.",
    docLinks: [docs("deliverables/FASE5_CALENDAR_SYNC.md")],
    disciplines: D(
      "Lazy load calendario; drawer creazione; fusi orari; badge stato sync OAuth.",
      "`calendar.routes`, servizi Outlook/Graph dove implementati; mapping eventId esterno.",
      "Persistenza `tz_calendar_events` (o equivalente); indici per range date e workspace.",
      "UX conflitti e sovrapposizioni; mobile week view.",
      "Test account OAuth di test; refresh token fallito.",
      "E2E crea evento → compare in lista → edit.",
    ),
  },
  {
    idTema: "workspaces-users-admin",
    areaPrefix: "[Cross]",
    title: "Admin — Workspaces e Users (liste, ruoli, membership)",
    summary:
      "Amministrazione workspace e utenti: associazione ai progetti, ruoli nel workspace e operazioni riservate agli admin.",
    docLinks: [docs("deliverables/FASE01_USER_ACCESS_RBAC.md")],
    disciplines: D(
      "Form creazione workspace, filtri utenti, wizard visibilità; gate `adminOnly` in nav.",
      "`workspaces.routes`, `users.routes`, `users-admin.routes`; reconciling ruoli.",
      "`tz_workspace`, membership collections; audit modifiche.",
      "Conferme distruttive; toast errori API.",
      "Permessi solo admin; tentativo viewer → 403.",
      "E2E creazione utente e assegnazione progetto.",
    ),
  },
  {
    idTema: "workflow-config-ui",
    areaPrefix: "[Cross]",
    title: "Configurazione workflow trattative (stati e transizioni)",
    summary:
      "Configura stati e transizioni delle trattative per workspace; le definizioni salvate si applicano a tutte le richieste del tenant.",
    docLinks: [docs("REQUESTS_MODEL.md")],
    disciplines: D(
      "Editor stati/transizioni; validazione client-side; preview impatto.",
      "`workflow.routes`, persistenza `WorkflowRow` / definizioni; migrazione stati esistenti.",
      "Versioning definizioni workflow; backup prima save.",
      "Avvisi su trattative in stato non più definito.",
      "Test regressione dopo cambio workflow; dry-run migrazione stati.",
      "Snapshot definizione in test integrazione.",
    ),
  },
  {
    idTema: "hc-catalog-templates",
    areaPrefix: "[Cross]",
    title: "HC — catalogo master, template configurazione progetto",
    summary:
      "Gestione cataloghi master e template di configurazione per progetto, con validazione degli schemi prima del salvataggio.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Tabs entità HC, form dinamici, validate prima del save; loading stati.",
      "`hc.routes`, templates routes; validazione schema lato server.",
      "Cataloghi master e `ConfigurationTemplateSchema` persistiti per `projectId`.",
      "Errori validazione campo-per-campo; help inline.",
      "Dataset template invalidi; size limit JSON.",
      "Test validate endpoint; E2E salva template.",
    ),
  },
  {
    idTema: "email-flows-transactional",
    areaPrefix: "[Cross]",
    title: "Email flows — template transazionali e invio",
    summary:
      "Template email transazionali con variabili, anteprima e invio di prova; integrazione con il provider e permessi di gestione dedicati.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Lista template, editor, test invio; gate admin.",
      "`email-flows.routes`, `email.service`, layout compose.",
      "Persistenza template e versioni; log invii.",
      "Anteprima con dati di esempio; warning variabili mancanti.",
      "Test invio mock/SMTP mock; sanitizzazione HTML.",
      "E2E modifica template e salvataggio.",
    ),
  },
  {
    idTema: "audit-log-security",
    areaPrefix: "[Cross]",
    title: "Audit log — tracciamento CRUD e consultazione admin",
    summary:
      "Consultazione eventi di audit con filtri, export opzionale e correlazione alle richieste HTTP per analisi e incident response.",
    docLinks: [docs("SECURITY_RUNBOOK.md")],
    disciplines: D(
      "Tabella paginata, filtri data/utente/entità; performance scroll.",
      "`audit` routes + servizio audit; non esporre PII in eccesso.",
      "Store eventi immutabili; retention policy.",
      "Leggibilità azione (create/update/delete) e entità.",
      "Permessi stretti; tentativo viewer → negato.",
      "Test volume elevato; indici query audit.",
    ),
  },
  {
    idTema: "gdpr-compliance-erasure",
    areaPrefix: "[Cross]",
    title: "GDPR — export/cancellazione dati utente",
    summary:
      "Richieste di export o cancellazione dati personali con orchestrazione job e verifica degli esiti per conformità normativa.",
    docLinks: [docs("SECURITY_RUNBOOK.md")],
    disciplines: D(
      "UI amministrativa o self-service se esposta; stati richiesta chiari.",
      "`gdpr-user.routes`, `compliance.routes`; idempotenza richieste.",
      "Cancellazione a cascata su collections correlate; log prove per audit legale.",
      "Copy privacy e tempi di attesa.",
      "Test doppio click; fallimento parziale e retry.",
      "Integration test con DB di test isolato.",
    ),
  },
  {
    idTema: "customer-portal-public",
    areaPrefix: "[Cross]",
    title: "Customer portal — area pubblica separata dal broker",
    summary:
      "Area pubblica separata per il cliente finale: accesso con token o sessione dedicata senza mescolare i dati dell’app broker.",
    docLinks: [docs("FOLLOWUP_3_MASTER.md")],
    disciplines: D(
      "Routing `App.tsx` branch `/portal`; UI semplificata; no leakage dati broker.",
      "`customer-portal.routes`, validazione token magic link.",
      "Separazione dati tenant; rate limit pubblico.",
      "UX mobile-first; messaggi errore generici in prod.",
      "Pen test superficie pubblica; XSS su campi input.",
      "E2E flusso portal con token di test.",
    ),
  },
  {
    idTema: "contracts-signatures",
    areaPrefix: "[Cross]",
    title: "Contratti e firma — webhook e stato pratica",
    summary:
      "Integrazione con provider di firma elettronica, aggiornamento stato pratica tramite webhook verificati e collegamento a trattative e documenti.",
    docLinks: [docs("SECURITY_RUNBOOK.md")],
    disciplines: D(
      "Stato firma in UI trattativa; link esterno provider; gestione scadenzario.",
      "Verifica firma webhook signature; retry; dead letter.",
      "Persistenza stato contratto; correlazione `requestId`.",
      "Messaggi se firma in attesa vs completata.",
      "Test webhook malformato; IP non in allowlist.",
      "Integration test webhook con payload fixture.",
    ),
  },
  {
    idTema: "communications-whatsapp-sms",
    areaPrefix: "[Cross]",
    title: "Comunicazioni — WhatsApp, SMS, routing policy",
    summary:
      "Invio SMS e messaggistica (es. WhatsApp) rispettando policy di routing, provider configurati e entitlement commerciale.",
    docLinks: [docs("deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md")],
    disciplines: D(
      "UI invio/test (se esposta); log esiti; indicatori entitlement.",
      "`whatsapp.service`, `routing-policy-engine`, errori strutturati.",
      "Log messaggi con mascheramento telefono; rate limit.",
      "Copy opt-in e template approvati provider.",
      "Test sandbox Twilio; fallback provider.",
      "Contract test payload webhook provider.",
    ),
  },
  {
    idTema: "webhook-automation-rules",
    areaPrefix: "[Cross]",
    title: "Webhook e automation rules — trigger e payload",
    summary:
      "Regole e webhook configurabili con prova manuale, log delle esecuzioni e gestione degli errori di invio.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "IntegrationsPage tab regole; form JSON path; pulsante test.",
      "Validazione URL HTTPS; firma HMAC opzionale; coda retry.",
      "Storage configurazioni e storico run.",
      "UX errore ultimo invio visibile.",
      "Test regola che genera loop; timeout.",
      "Integration mock HTTP server webhook.",
    ),
  },
  {
    idTema: "platform-api-keys-rate-limit",
    areaPrefix: "[Cross]",
    title: "Platform API — chiavi, scope workspace/progetto, rate limit",
    summary:
      "Chiavi API per integrazioni esterne con scope su workspace e progetti, rate limit e validazione su ogni richiesta.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Tab API in Integrazioni; rotazione chiavi; copy sicuro una tantum.",
      "Validazione key → workspaceId/projectIds; header `x-api-key`; 401/403 distinti.",
      "Nessun secret in log; audit accessi opzionale.",
      "Documentare limiti in UI per il cliente.",
      "Test superamento rate limit; key revocata.",
      "Postman/newman contro route platform.",
    ),
  },
  {
    idTema: "realtime-bus-ui",
    areaPrefix: "[Cross]",
    title: "Realtime — bus eventi, aggiornamenti UI live",
    summary:
      "Aggiornamenti in tempo reale su liste e report quando è disponibile un canale eventi, con fallback se la connessione cade.",
    docLinks: [docs("OBSERVABILITY.md")],
    disciplines: D(
      "Hook reconnect; indicatori connessione; fallback polling.",
      "`realtime-bus.service`, autenticazione canale, heartbeat.",
      "Nessun dato sensibile in payload evento pubblico.",
      "Debounce aggiornamenti per non disturbare UX.",
      "Chiusura tab e leak listener.",
      "Test stress eventi; Vitest mock socket.",
    ),
  },
  {
    idTema: "notifications-domain",
    areaPrefix: "[Cross]",
    title: "Notifiche — modello dati, tipi e Inbox",
    summary:
      "Genera notifiche coerenti da calendario, trattative e automazioni e le rende consumabili dall’inbox in-app.",
    docLinks: [docs("deliverables/FASE7_INBOX_CONTRACT.md")],
    disciplines: D(
      "`InboxPage`, badge header, deep link a contesto; preferenze mute.",
      "Creazione notifiche idempotente; dedup chiavi.",
      "Indici per userId/workspaceId/unread; retention.",
      "Priorità visiva; accessibilità annunci screen reader.",
      "Marcatura letto bulk; consistenza dopo refresh.",
      "E2E notifica sintetica → Inbox → navigazione.",
    ),
  },
  {
    idTema: "quotes-domain-public",
    areaPrefix: "[Sell]",
    title: "Preventivi — query, totali legacy e API pubbliche",
    summary:
      "Preventivi collegati a trattative e asset, con endpoint pubblici dove previsto e totali allineati al modello dati.",
    docLinks: [docs("deliverables/FASE2_DIGITAL_QUOTE.md")],
    disciplines: D(
      "UI preventivi in trattativa; totali e arrotondamenti visibili.",
      "`quotes.service`, `legacy-quote-total`, validazione permessi.",
      "Schema quote e versioni; collegamento `requestId`.",
      "Chiarezza IVA e valuta.",
      "Regression calcolo totali vs legacy.",
      "Test fixture quote complesse.",
    ),
  },
  {
    idTema: "projects-legacy-detail",
    areaPrefix: "[Cross]",
    title: "Progetti — dettaglio, override legacy, policy",
    summary:
      "Scheda progetto con dati operativi e correzioni legacy, confronto tra origine storica e stato corrente e policy commerciale per progetto.",
    docLinks: [docs("MAIN_DB_SCHEMA.md")],
    disciplines: D(
      "`ProjectDetailPage`, `ProjectsPage`; confronto dati legacy vs tz.",
      "Merge raw project; override campi; permessi lettura.",
      "Persistenza override in collection dedicata; audit.",
      "Spiegare all’utente origine dato (legacy vs operativo).",
      "Test incoerenze ID progetto workspace.",
      "Integration test caricamento dettaglio.",
    ),
  },
  {
    idTema: "assets-client-documents",
    areaPrefix: "[Cross]",
    title: "Documenti cliente/asset — upload e metadati",
    summary:
      "Upload e gestione documenti su clienti e asset con storage su object storage e controllo degli accessi in lettura.",
    docLinks: [docs("deliverables/FASE3_S3_VERIFICATION.md")],
    disciplines: D(
      "Lista documenti in scheda cliente; upload con progress; tipi file.",
      "Presigned PUT/GET; validazione MIME e size server-side.",
      "Metadati in DB; soft delete; virus scan se previsto.",
      "Messaggi quota e formato non supportato.",
      "Test ACL: utente altro workspace non scarica.",
      "E2E upload piccolo file su staging.",
    ),
  },
  {
    idTema: "additional-infos-custom-fields",
    areaPrefix: "[Cross]",
    title: "Informazioni aggiuntive — campi personalizzati sulle entità",
    summary:
      "Campi personalizzati su clienti e appartamenti con schema validato lato server e form dinamici in interfaccia.",
    docLinks: [docs("CLIENT_APARTMENT_MODEL.md")],
    disciplines: D(
      "Form dinamici; reorder campi; visibilità per ruolo.",
      "Validazione tipi (string/number/date); merge su entità.",
      "Storage embedded o collection satellite; indici query.",
      "UX: etichette e help per utente business.",
      "Test limite numero campi e lunghezza stringa.",
      "API contract test CRUD.",
    ),
  },
  {
    idTema: "marketing-automation-nurture",
    areaPrefix: "[Cross]",
    title: "Marketing automation — liste esterne, contatti da payload",
    summary:
      "Sincronizzazione contatti verso strumenti marketing (es. Mailchimp, ActiveCampaign) con entitlement e gestione errori provider.",
    docLinks: [docs("MARKETING_APIS_RUNBOOK.md")],
    disciplines: D(
      "Stato sync in UI; retry manuale; indicatori entitlement.",
      "Servizi `marketing-contact-from-payload`, OAuth/API key config.",
      "Log sync con hash email; GDPR sulle liste.",
      "Copy consensi e opt-out.",
      "Test provider mock; rate limit API marketing.",
      "Integration test con cassette.",
    ),
  },
  {
    idTema: "mls-feed-import",
    areaPrefix: "[Sell]",
    title: "MLS feed — import e normalizzazione listing",
    summary:
      "Importazione feed MLS esterni con normalizzazione unità, deduplicazione e risoluzione conflitti con dati inseriti a mano.",
    docLinks: [docs("README.md")],
    disciplines: D(
      "Dashboard ultimo import; errori riga per riga scaricabili.",
      "Parser streaming; checkpoint; job idempotenti.",
      "Staging table o flag su `tz_apartments`; merge rules.",
      "Avvisi sovrascrittura campi modificati a mano.",
      "Test feed malformato; file enormi.",
      "Fixture XML/JSON ridotte in test.",
    ),
  },
  {
    idTema: "privacy-consent-records",
    areaPrefix: "[Cross]",
    title: "Privacy — consensi e registry",
    summary:
      "Registro consensi privacy con versione informativa, storico e possibilità di esportare le prove richieste.",
    docLinks: [docs("SECURITY_RUNBOOK.md")],
    disciplines: D(
      "Banner o pagina consensi; storico versioni.",
      "Timestamp e fonte consenso; immutabilità record.",
      "Indici per utente/soggetto.",
      "UX chiaro su revoca.",
      "Test revoca e re-consenso.",
      "Audit legale campione record.",
    ),
  },
  {
    idTema: "ops-scale-health",
    areaPrefix: "[QA]",
    title: "Ops — health check, scale-out hooks",
    summary:
      "Endpoint operativi protetti per health, readiness e hook di scalabilità orizzontale in ambiente di orchestrazione.",
    docLinks: [docs("OBSERVABILITY.md"), docs("RENDER_DEPLOY.md")],
    disciplines: D(
      "N/A o dashboard interna minima.",
      "Autenticazione chiamate ops; no info sensibili in `/health` pubblico.",
      "N/A.",
      "N/A.",
      "Checklist deploy: health verde dopo release.",
      "Smoke curl su `/v1/health` e ops protetto.",
    ),
  },
  {
    idTema: "intelligence-routes",
    areaPrefix: "[Cross]",
    title: "Intelligence / analytics interni (endpoint dedicati)",
    summary:
      "Insight aggregati interni (se abilitati), distinti dal modulo Big Data marketing, con query e permessi dedicati.",
    docLinks: [docs("telemetry/KPI_AND_DASHBOARDS.md")],
    disciplines: D(
      "Widget in cockpit o pagina dedicata; loading skeleton.",
      "Query aggregate con timeout; cache; permessi.",
      "Materialized views o cache Redis se presente.",
      "Empty state se dati insufficienti.",
      "Test performance query pesanti.",
      "Mock dati in dev.",
    ),
  },
  {
    idTema: "discovery-workflow-product",
    areaPrefix: "[Cross]",
    title: "Discovery workflow — pipeline idee/opportunità",
    summary:
      "Pipeline di stati da feedback prodotto a elementi di roadmap, collegata alla pagina Product Discovery.",
    docLinks: [docs("JIRA_TRACEABILITY_FOLLOWUP_3.md")],
    disciplines: D(
      "Board o tab workflow in ProductDiscoveryPage; drag-drop se previsto.",
      "Validazione transizioni; audit chi ha spostato la card.",
      "Persistenza stato per `opportunity`/`feature`.",
      "Coerenza label stati con Jira.",
      "Permessi solo admin product.",
      "E2E spostamento card.",
    ),
  },
  {
    idTema: "pwa-offline-telemetry",
    areaPrefix: "[Cross]",
    title: "PWA — installazione, aggiornamenti, offline e telemetria",
    summary:
      "Prompt installazione PWA, aggiornamenti, stato della rete e telemetria di navigazione con messaggi chiari in modalità offline.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Service worker update flow; banner offline non invasivo; prompt install iOS/Android.",
      "Nessuna chiamata API con dati PII in telemetry senza consenso.",
      "N/A.",
      "Messaggi quando azione non disponibile offline.",
      "Test navigazione offline su route cached.",
      "Lighthouse PWA budget CI se presente.",
    ),
  },
  {
    idTema: "bss-auth-adapter",
    areaPrefix: "[Cross]",
    title: "Adapter autenticazione BSS / gateway",
    summary:
      "Adatta l’autenticazione al gateway BSS esterno mappando ruoli e permessi al modello dell’app quando la feature è attiva.",
    docLinks: [docs("AUTH_AND_TECMA_BSS_API_REPORT.md")],
    disciplines: D(
      "Inizializzazione client HTTP con base URL gateway; gestione 401 centralizzata.",
      "Allineamento permessi JWT BSS con `PermissionGated`.",
      "N/A.",
      "Messaggi quando gateway irraggiungibile.",
      "Test toggle BSS on/off.",
      "Contract test verso mock gateway.",
    ),
  },
  {
    idTema: "product-blueprint-jira-console",
    areaPrefix: "[Cross]",
    title: "Product Blueprint Jira — catalogo PRD e pubblicazione issue",
    summary:
      "Console Tecma per pubblicare su Jira descrizioni e subtask dal catalogo PRD e tenere traccia dello stato di pubblicazione.",
    docLinks: [docs("JIRA_TRACEABILITY_FOLLOWUP_3.md"), docs("FOLLOWUP_3_FUNZIONALITA_COMPLETE_E_AI_JIRA.md")],
    disciplines: D(
      "`ProductBlueprintPage`: tabella filtri, anteprima testi, link browse Jira, badge completamento.",
      "`jira-prd.routes`, `jira-prd.service`, `jira-rest-client`, variabili `JIRA_*`; errori 503 se non configurato.",
      "Collection `tz_jira_prd_links`; indice unico `idTema`; idempotenza publish.",
      "Copy chiaro su “forza ripubblicazione” e issue orfane.",
      "Test permessi Tecma admin; 403 non admin.",
      "Vitest catalog + ADF; staging con progetto Jira test.",
    ),
  },
  {
    idTema: "executive-overview-strategic",
    areaPrefix: "[Cross]",
    title: "Panoramica strategica CTO/CEO — documentazione e Mermaid",
    summary:
      "Hub di lettura per CTO/CEO con documentazione architetturale e diagrammi, caricamento on demand e contenuti sanitizzati.",
    docLinks: [docs("FOLLOWUP_3_MASTER.md")],
    disciplines: D(
      "Lazy load pesante; link `VITE_FOLLOWUP_DOCS_BASE_URL`; rendering markdown sicuro.",
      "Nessun secret in documenti embed; sanitizzazione HTML markdown.",
      "N/A.",
      "Navigazione chiara per ruolo executive.",
      "Test link rotti verso repo.",
      "E2E smoke apertura pagina.",
    ),
  },
  {
    idTema: "coima-gap-assessment",
    areaPrefix: "[Cross]",
    title: "COIMA / BTS — assessment gap requisiti",
    summary:
      "Valutazione dei gap tra requisiti cliente e capacità della piattaforma, con checklist e export per il commerciale.",
    docLinks: [docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "Form valutazione; salvataggio bozza; export PDF/markdown.",
      "Endpoint persistenza assessment se presenti.",
      "Storage risultati per workspace.",
      "Linguaggio adatto a stakeholder non tecnici.",
      "Validazione completezza prima export.",
      "Test regressione calcolo punteggio gap.",
    ),
  },
  /** Esempi voce technical (figlia) — stesso pattern estendibile ad altri idTema */
  {
    idTema: "close-phase0-technical-matching-api",
    kind: "technical",
    parentIdTema: "close-phase0",
    areaPrefix: "[Cross]",
    title: "Matching candidati — endpoint e punteggio (dettaglio BE)",
    summary:
      "Dettaglio backend del matching: API di scoring, permessi verso le API di piattaforma e ambito workspace allineati al tema padre.",
    docLinks: [docs("MATCHING.md"), docs("PIANO_GLOBALE_FOLLOWUP_3.md")],
    disciplines: D(
      "N/A se solo BE; eventuale badge punteggio in UI già coperto dal tema padre.",
      "matching.routes, validazione input, errori strutturati, integrazione con liste clients/apartments filtrate.",
      "Indici su campi usati nello score; evitare full scan su grandi tenant.",
      "N/A.",
      "Dataset noti per regressione punteggio; permessi viewer.",
      "Test integrazione route matching con fixture Mongo.",
    ),
    prd: {
      problemJob: "I broker devono ricevere candidati ordinati senza esporre dati fuori workspace.",
      expectedBehavior: "GET matching restituisce lista ordinata con motivazione punteggio lato log (non necessariamente in risposta).",
      nonGoals: "Non include training ML esterno né scoring opaco non documentato.",
    },
  },
  {
    idTema: "auth-core-technical-mfa-lockout",
    kind: "technical",
    parentIdTema: "auth-core",
    areaPrefix: "[Cross]",
    title: "MFA, lockout e sessioni — hardening sicurezza",
    summary:
      "Rafforza MFA, tentativi falliti e revoca sessioni oltre al flusso di login principale (TOTP, backup code, lockout).",
    docLinks: [docs("AUTH_AUDIT_POLICY.md")],
    disciplines: D(
      "AccountSecurityPage, flussi verify MFA, messaggi lockout.",
      "mfa.service, accountLockout, refreshSession, revoca sessioni.",
      "TTL e indici su sessioni; hashing secret MFA.",
      "Copy chiaro su tentativi rimasti.",
      "Brute force su staging; lockout recovery.",
      "Test unit e integrazione lockout.",
    ),
  },
  {
    idTema: "product-blueprint-jira-technical-rest",
    kind: "technical",
    parentIdTema: "product-blueprint-jira-console",
    areaPrefix: "[Cross]",
    title: "Jira REST client e ADF — create/search issue",
    summary:
      "Client e formattazione verso Jira (inclusi contenuti ADF) per creare e cercare issue dalla pubblicazione del catalogo.",
    docLinks: [docs("JIRA_TRACEABILITY_FOLLOWUP_3.md")],
    disciplines: D(
      "N/A (logica backend).",
      "jira-rest-client.ts, jira-adf.ts, errori HttpError mappati.",
      "N/A.",
      "N/A.",
      "Test con fetch mock; nessun secret in log.",
      "Vitest jira-adf; mock create/search.",
    ),
  },
];

export const FEATURE_CATALOG: FeatureCatalogEntry[] = FEATURE_CATALOG_INPUT.map(enrichRow);
