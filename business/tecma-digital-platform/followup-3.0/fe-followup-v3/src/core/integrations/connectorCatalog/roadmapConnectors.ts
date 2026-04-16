import type { ConnectorCatalogItem, ConnectorGroup } from "./types";

function roadmap(
  id: string,
  name: string,
  group: ConnectorGroup,
  description: string,
  capabilities: string[],
  prerequisites: string[],
  brandId?: string
): ConnectorCatalogItem {
  return {
    id,
    name,
    group,
    status: "coming_soon",
    description,
    capabilities,
    prerequisites,
    ...(brandId ? { brandId } : {}),
  };
}

/**
 * Connettori solo roadmap / vetrina: si aggiungono qui per non appesantire `coreConnectors.ts`.
 * Stato uniforme `coming_soon` salvo eccezioni gestite nel core.
 */
export const roadmapConnectors: ConnectorCatalogItem[] = [
  roadmap(
    "connector_flywire",
    "Flywire",
    "Payments & Billing",
    "Incassi cross-border e piani rateali tipici di tuition, healthcare e grandi transazioni B2B: ideale per acconti e saldi su trattative con importi in valuta estera e tracciamento verso la pratica commerciale.",
    ["Pagamenti internazionali", "FX e bonifici tracciati", "Webhook stato pagamento", "Riconciliazione", "Portale pagatore"],
    ["Account Flywire", "Merchant ID", "Webhook / API key", "Accordo commerciale dove richiesto"],
    "flywire"
  ),
  roadmap(
    "connector_adyen",
    "Adyen",
    "Payments & Billing",
    "Gateway omnicanale per POS, e-commerce e marketplace: unifica carte, wallet e metodi locali con gestione dispute e payout verso conti collegati al ciclo commerciale.",
    ["Terminali & online", "Settlement reporting", "3DS", "Risk engine", "Marketplace split"],
    ["Merchant account Adyen", "API key live/test", "Webhook HMAC"]
  ),
  roadmap(
    "connector_mollie",
    "Mollie",
    "Payments & Billing",
    "PSP europeo con onboarding rapido: ideal link, SEPA, iDEAL e carte per incassi leggeri su portali self-service e canoni ricorrenti.",
    ["Checkout hosted", "Mandati SEPA", "Subscription", "Webhook eventi"],
    ["Account Mollie", "API key", "Profile ID"]
  ),
  roadmap(
    "connector_klarna",
    "Klarna",
    "Payments & Billing",
    "Pagamento dilazionato e pay-in-3 per retail ad alto valore: integrazione con ordini e stato incasso in trattativa quando il modello commerciale lo prevede.",
    ["Pay later", "Installments", "Order lines", "Refund API"],
    ["Merchant Klarna", "Regioni abilitate", "Credenziali API"]
  ),
  roadmap(
    "connector_revolut_business",
    "Revolut Business",
    "Payments & Billing",
    "Conto e carte business con API per bonifici, FX e controllo cashflow; notifiche verso CRM per incassi e commissioni.",
    ["Bonifici SEPA/SWIFT", "FX spot", "Webhook transazioni", "Conti multi-valuta"],
    ["Account Revolut Business", "API access", "OAuth / API key"]
  ),
  roadmap(
    "connector_wise_business",
    "Wise Business",
    "Payments & Billing",
    "Bonifici internazionali con costi trasparenti e ricezione in IBAN locali: utile per canoni e depositi cauzionali cross-border.",
    ["Recipient API", "Quote FX", "Batch payout", "Webhook transfer"],
    ["Account Wise Business", "API token", "Profilo verificato"]
  ),
  roadmap(
    "connector_gocardless",
    "GoCardless",
    "Payments & Billing",
    "Addebiti diretti SEPA e UK Direct Debit per canoni ricorrenti e rate plan su contratti lunghi.",
    ["Mandati", "Subscription", "Payout", "Webhook"],
    ["Account GoCardless", "Access token", "Schema creditor"]
  ),
  roadmap(
    "connector_checkout_com",
    "Checkout.com",
    "Payments & Billing",
    "Acquiring globale con orchestrazione e unified reporting per e-commerce e pagamenti su misura per mercati multipli.",
    ["Processing", "Payout", "Dispute API", "Network tokens"],
    ["Account Checkout.com", "Secret API keys", "Webhook signing"]
  ),
  roadmap(
    "connector_worldline",
    "Worldline",
    "Payments & Billing",
    "Ecosistema pagamenti europeo (terminali, e-commerce, wallet): integrazione per contesti retail e hospitality collegati a progetti immobiliari.",
    ["Terminali", "Hosted payment", "Reporting", "Reconciliation"],
    ["Contratto Worldline", "Terminali / e-com credentials"]
  ),
  roadmap(
    "connector_nexi",
    "Nexi",
    "Payments & Billing",
    "Acquiring e POS sul mercato italiano: allineamento incassi carta con pratiche e incassi in sede.",
    ["POS & e-commerce", "Settlement", "Conciliazione"],
    ["Merchant Nexi", "API / terminale abilitato"]
  ),
  roadmap(
    "connector_satispay_business",
    "Satispay Business",
    "Payments & Billing",
    "Incassi consumer-to-business tramite app Satispay per acconti rapidi e pagamenti in presenza o da link.",
    ["Payment request", "QR / link", "Webhook", "Export movimenti"],
    ["Account Satispay Business", "Shop ID", "API OAuth"]
  ),
  roadmap(
    "connector_square",
    "Square",
    "Payments & Billing",
    "POS, online e fatturazione per operatori che gestiscono incassi in sede e su e-commerce con un unico ledger.",
    ["Payments API", "Invoices", "Catalog sync", "Webhook"],
    ["Square account", "Application ID", "Access token"]
  ),
  roadmap(
    "connector_braintree",
    "Braintree",
    "Payments & Billing",
    "Gateway PayPal per carte, PayPal wallet e metodi locali con vault e piani ricorrenti.",
    ["Drop-in UI", "Vault", "Subscriptions", "Webhooks"],
    ["Merchant Braintree", "Public + private key"]
  ),
  roadmap(
    "connector_dynamics_365_sales",
    "Microsoft Dynamics 365 Sales",
    "CRM/Lead Sources",
    "Sincronizzazione account, opportunità e attività con Dataverse per organizzazioni già su stack Microsoft.",
    ["Dual write / sync", "Tabelle custom", "Power Automate"],
    ["Tenant Azure AD", "App registration", "URL organizzazione"]
  ),
  roadmap(
    "connector_zoho_crm",
    "Zoho CRM",
    "CRM/Lead Sources",
    "Allineamento lead e deal per team che usano Zoho come CRM satellite o per filiali estere.",
    ["Lead & deal sync", "Blueprint", "Custom modules"],
    ["Account Zoho", "OAuth client", "Org ID"]
  ),
  roadmap(
    "connector_copper",
    "Copper",
    "CRM/Lead Sources",
    "CRM Google-native leggero: mirror opportunità e contatti per piccoli team commerciali.",
    ["People & pipeline", "Gmail sidebar", "Automation"],
    ["Account Copper", "API key"]
  ),
  roadmap(
    "connector_freshsales",
    "Freshsales",
    "CRM/Lead Sources",
    "Suite Freshworks: lead scoring, sequenze e telefonia integrata collegata al funnel Tecma.",
    ["Lead scoring", "Sequences", "Deal stages"],
    ["Freshsales account", "API key"]
  ),
  roadmap(
    "connector_close_crm",
    "Close",
    "CRM/Lead Sources",
    "CRM con dialer e SMS integrati: sync chiamate e SMS outbound con timeline trattativa.",
    ["Lead sync", "Call logging", "SMS"],
    ["Account Close", "API key"]
  ),
  roadmap(
    "connector_sugarcrm",
    "SugarCRM",
    "CRM/Lead Sources",
    "Piattaforma CRM open e altamente customizzabile per verticali con moduli estesi.",
    ["REST API", "Custom modules", "Workflow"],
    ["Istanza Sugar", "OAuth2 client"]
  ),
  roadmap(
    "connector_klaviyo",
    "Klaviyo",
    "Marketing",
    "Automazioni email e SMS basate su eventi e profili unificati: cohort e flussi legati a eventi CRM.",
    ["Event streaming", "Flows", "Segmenti", "Predictive analytics"],
    ["Account Klaviyo", "Private API key"]
  ),
  roadmap(
    "connector_braze",
    "Braze",
    "Marketing",
    "Orchestrazione cross-channel (push, email, SMS, in-app) per journey complessi su base comportamento.",
    ["Canvas", "Connected content", "User profiles"],
    ["Workspace Braze", "REST API key"]
  ),
  roadmap(
    "connector_customer_io",
    "Customer.io",
    "Marketing",
    "Messaggistica transazionale e campagne data-driven con segmentazione su attributi CRM.",
    ["Campaigns", "Newsletters", "Webhooks inbound"],
    ["Site ID", "API credentials"]
  ),
  roadmap(
    "connector_brevo",
    "Brevo (ex Sendinblue)",
    "Marketing",
    "Email, SMS e automation con costi competitivi per newsletter e trigger operativi.",
    ["Transactional email", "Marketing automation", "SMS"],
    ["Account Brevo", "API key v3"]
  ),
  roadmap(
    "connector_iterable",
    "Iterable",
    "Marketing",
    "Journey cross-channel per team growth con cataloghi e preferenze utente.",
    ["Journeys", "Catalog", "Data feeds"],
    ["Account Iterable", "API key"]
  ),
  roadmap(
    "connector_omnisend",
    "Omnisend",
    "Marketing",
    "Marketing automation e-commerce oriented con segmenti prodotti e carrelli.",
    ["Automation", "Segments", "Product sync"],
    ["Account Omnisend", "API key"]
  ),
  roadmap(
    "connector_vonage",
    "Vonage (Nexmo)",
    "Communication",
    "SMS e voice API per OTP, notifiche critiche e callback verso numeri commerciali.",
    ["SMS API", "Voice", "Verify"],
    ["API key + secret", "Numeri abilitati"]
  ),
  roadmap(
    "connector_plivo",
    "Plivo",
    "Communication",
    "SMS e voce cloud con pricing trasparente per notifiche e conferme appuntamento.",
    ["SMS", "Voice", "PHLO"],
    ["Auth ID", "Auth token"]
  ),
  roadmap(
    "connector_messagebird",
    "MessageBird",
    "Communication",
    "Omnicanale (SMS, WhatsApp, email) con Inbox unificata per team assistenza.",
    ["Conversations API", "Flow builder", "Templates"],
    ["Access key", "Channel IDs"]
  ),
  roadmap(
    "connector_intercom",
    "Intercom",
    "Communication",
    "Chat, help center e outbound per supporto clienti collegato a utenti CRM.",
    ["Messenger", "Tickets", "Outbound messages"],
    ["Workspace Intercom", "Access token"]
  ),
  roadmap(
    "connector_ringcentral",
    "RingCentral",
    "Communication",
    "UCaaS: log chiamate, voicemail e SMS business per activity timeline.",
    ["Call log API", "SMS", "Presence"],
    ["Account RingCentral", "JWT / OAuth app"]
  ),
  roadmap(
    "connector_zoom",
    "Zoom",
    "Communication",
    "Meeting e webinar: creazione eventi da trattative e link partecipazione in timeline.",
    ["Meetings API", "Webhooks", "Recording links"],
    ["Zoom app", "OAuth", "Account ID"]
  ),
  roadmap(
    "connector_aircall",
    "Aircall",
    "Communication",
    "Centralino cloud con numeri locali e integrazione CRM per log chiamate e note.",
    ["Call events", "Power dialer", "Tags"],
    ["Aircall API ID", "API token"]
  ),
  roadmap(
    "connector_notion",
    "Notion",
    "Productivity/Collab",
    "Wiki e database condivisi: spec progetti, playbook vendita e checklist onboarding cliente.",
    ["Pages API", "Databases", "Comments"],
    ["Integration Notion", "Internal token"]
  ),
  roadmap(
    "connector_asana",
    "Asana",
    "Productivity/Collab",
    "Task e progetti per coordinamento commerciale e handoff post-vendita.",
    ["Tasks", "Projects", "Custom fields"],
    ["Asana PAT", "Workspace GID"]
  ),
  roadmap(
    "connector_monday",
    "monday.com",
    "Productivity/Collab",
    "Board e automazioni per pipeline interne e retail operations.",
    ["Boards API", "Items", "Automations"],
    ["API token", "Board IDs"]
  ),
  roadmap(
    "connector_jira",
    "Jira Cloud",
    "Productivity/Collab",
    "Issue tracking per richieste IT e bug collegati a progetti immobiliari e integrazioni.",
    ["Issues API", "Webhooks", "JQL"],
    ["Site Atlassian", "OAuth / API token"]
  ),
  roadmap(
    "connector_confluence",
    "Confluence",
    "Productivity/Collab",
    "Documentazione e knowledge base per processi e template contrattuali interni.",
    ["Pages", "Spaces", "Search"],
    ["Atlassian cloud", "API token"]
  ),
  roadmap(
    "connector_linear",
    "Linear",
    "Productivity/Collab",
    "Issue tracking moderno per team prodotto e engineering legati a roadmap Tecma.",
    ["Issues", "Cycles", "GraphQL API"],
    ["Linear API key", "Team ID"]
  ),
  roadmap(
    "connector_clickup",
    "ClickUp",
    "Productivity/Collab",
    "Task, doc e goal per coordinamento cross-team su commesse complesse.",
    ["Tasks", "Lists", "Time tracking"],
    ["Personal token", "Workspace ID"]
  ),
  roadmap(
    "connector_google_workspace",
    "Google Workspace",
    "Productivity/Collab",
    "Directory, Calendar e Drive a livello aziendale: provisioning utenti e link documenti condivisi con pratiche.",
    ["Admin SDK", "Calendar sync", "Drive links"],
    ["Service account domain-wide", "OAuth scopes"]
  ),
  roadmap(
    "connector_atlassian",
    "Atlassian (suite)",
    "Productivity/Collab",
    "Ecosistema Jira + Confluence + Compass per tracciabilità end-to-end su iniziative cliente.",
    ["Unified admin", "OAuth apps", "Audit log"],
    ["Organizzazione Atlassian", "Client OAuth"]
  ),
  roadmap(
    "connector_lexisnexis",
    "LexisNexis Risk",
    "Compliance",
    "Dataset risk e fraud per rafforzare decisioni su soggetti e transazioni ad alto rischio.",
    ["Identity verification", "Fraud intelligence", "Batch screening"],
    ["Contratto LexisNexis", "Certificati API"]
  ),
  roadmap(
    "connector_dow_jones_risk",
    "Dow Jones Risk & Compliance",
    "Compliance",
    "Screening PEP, sanzioni e adverse media per istituzioni e operatori soggetti a obblighi rafforzati.",
    ["Watchlist", "Screening API", "Audit"],
    ["Account DJ", "API credentials"]
  ),
  roadmap(
    "connector_refinitiv_worldcheck",
    "LSEG World-Check (ex Refinitiv)",
    "Compliance",
    "Database globale per AML e KYC enterprise con workflow di approvazione.",
    ["Screening", "Case management", "Audit trail"],
    ["Contratto LSEG", "Host certificato"]
  ),
  roadmap(
    "connector_middesk",
    "Middesk",
    "Compliance",
    "Verifica KYB su business US: EIN, indirizzo e documenti societari per onboarding partner.",
    ["Business verification", "Documents", "Webhooks"],
    ["API key Middesk", "Ambiente live/test"]
  ),
  roadmap(
    "connector_persona",
    "Persona",
    "Compliance",
    "Identità e document verification con flussi configurabili e review manuale.",
    ["Inquiry API", "Selfie & ID", "Webhooks"],
    ["Persona template ID", "API key"]
  ),
  roadmap(
    "connector_workato",
    "Workato",
    "Workflow Automation",
    "iPaaS enterprise con recipe, connettori certificati e governance per team IT.",
    ["Recipes", "On-prem agent", "API platform"],
    ["Workato workspace", "Embedded / OEM"]
  ),
  roadmap(
    "connector_tray_io",
    "Tray.io",
    "Workflow Automation",
    "Automazione low-code con workflow visuali e connettori SaaS per orchestrare CRM e marketing.",
    ["Workflows", "Connectors", "Auth"],
    ["Tray account", "Master token"]
  ),
  roadmap(
    "connector_boomi",
    "Boomi",
    "Workflow Automation",
    "Integrazione e ETL gestiti con AtomSphere per flussi B2B e mapping dati.",
    ["Processes", "Maps", "Trading partners"],
    ["Boomi account", "Atom runtime"]
  ),
  roadmap(
    "connector_mulesoft",
    "MuleSoft Anypoint",
    "Workflow Automation",
    "API-led connectivity e API manager per esporre dati Tecma in modo governato.",
    ["API Manager", "Exchange", "Policies"],
    ["Anypoint org", "Client credentials"]
  ),
  roadmap(
    "connector_celigo",
    "Celigo",
    "Workflow Automation",
    "Integrator.io per sync ERP-ecommerce e flussi ripetibili tra SaaS.",
    ["Integrations", "Flows", "Error management"],
    ["Celigo account", "License"]
  ),
  roadmap(
    "connector_wordpress",
    "WordPress",
    "Website/CMS",
    "Siti e landing immobiliari su WP: sync listing e form lead verso CRM.",
    ["REST API", "Webhooks", "Plugin bridge"],
    ["URL sito", "Application password / JWT"]
  ),
  roadmap(
    "connector_contentful",
    "Contentful",
    "Website/CMS",
    "Headless CMS per contenuti editoriali e SEO collegati a campagne e listing.",
    ["Content API", "Preview", "Webhooks"],
    ["Space ID", "Delivery + Preview tokens"]
  ),
  roadmap(
    "connector_strapi",
    "Strapi",
    "Website/CMS",
    "CMS open source self-hosted per portali e micro-siti verticali.",
    ["REST / GraphQL", "Media library", "Roles"],
    ["Strapi URL", "API token"]
  ),
  roadmap(
    "connector_sanity",
    "Sanity",
    "Website/CMS",
    "Structured content e real-time collaboration per siti headless e preview editoriale.",
    ["GROQ", "Dataset", "Webhooks"],
    ["Project ID", "Token"]
  ),
  roadmap(
    "connector_qlik",
    "Qlik",
    "Data/BI",
    "Associative engine e Sense per analisi esplorative su dataset commerciali replicati.",
    ["Qlik Sense", "NPrinting", "Data load"],
    ["Server / SaaS Qlik", "Licenze"]
  ),
  roadmap(
    "connector_sisense",
    "Sisense",
    "Data/BI",
    "Analytics embedded e mashup per white-label in portali partner.",
    ["Elasticube", "Embed SDK", "Live models"],
    ["Sisense stack", "API secret"]
  ),
  roadmap(
    "connector_domo",
    "Domo",
    "Data/BI",
    "BI cloud con ETL integrato e mobile-first per executive.",
    ["Dataflows", "Cards", "Alerts"],
    ["Domo instance", "Client ID"]
  ),
  roadmap(
    "connector_mode",
    "Mode Analytics",
    "Data/BI",
    "SQL + notebook per analisti che condividono report e scheduled digests.",
    ["Query", "Reports", "Schedules"],
    ["Mode workspace", "API token"]
  ),
  roadmap(
    "connector_preset",
    "Preset (Apache Superset)",
    "Data/BI",
    "Superset hosted: dashboard open source e semantic layer leggero.",
    ["Charts", "Datasets", "Alerts"],
    ["Preset workspace", "DB connection"]
  ),
  roadmap(
    "connector_signnow",
    "signNow",
    "Docs/Signature",
    "Firma elettronica con editor documenti e flussi rapidi per contratti standard.",
    ["Templates", "Bulk send", "API"],
    ["signNow account", "OAuth"]
  ),
  roadmap(
    "connector_contractbook",
    "Contractbook",
    "Docs/Signature",
    "Lifecycle contratti con repository centralizzato e reminder su scadenze.",
    ["Contract automation", "Repository", "Integrations"],
    ["Workspace", "API key"]
  ),
  roadmap(
    "connector_legalesign",
    "Legalesign",
    "Docs/Signature",
    "Firma UK/EU con focus conformità e API semplici per volumi alti.",
    ["eSign API", "Branding", "Webhooks"],
    ["Legalesign account", "API key"]
  ),
  roadmap(
    "connector_namirial",
    "Namirial",
    "Docs/Signature",
    "Firma e conservazione digitale nel perimetro europeo per PA e imprese.",
    ["eSignTrust", "Conservazione", "OTP"],
    ["Account Namirial", "Credenziali API"]
  ),
  roadmap(
    "connector_infosign",
    "InfoCert / Firma digitale",
    "Docs/Signature",
    "Servizi di firma e certificati qualificati per mercato italiano e SPID dove applicabile.",
    ["Firma qualificata", "Marca temporale", "API"],
    ["Accordo InfoCert", "Credential"]
  ),
];
