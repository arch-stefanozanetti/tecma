# Indice capability Followup 3.0 (generato)

> Generato da `yarn docs:capability-index` nella cartella `be-followup-v3`. Non modificare a mano.

| idTema | Area | Epic | Kind | Sintesi | designRefs |
|--------|------|------|------|---------|------------|
| additional-infos-custom-fields | [Cross] | E1 | product | Campi personalizzati su clienti e appartamenti con schema validato lato server e form dinamici in interfaccia. | — |
| apartments-domain-detail | [Cross] | E1 | product | Liste unità immobiliari e scheda dettaglio con collegamento a trattative e prezzi; supporta affitto e vendita e dati commerciali strutturati. | — |
| clients-apartments-core | [Cross] | E1 | product | Espone CRUD e liste su clienti e appartamenti con modelli di dominio allineati tra interfaccia e API. | — |
| clients-domain-detail | [Cross] | E1 | product | Liste e schede cliente con filtri per workspace e progetto; creazione e modifica condizionate dai permessi di lettura e scrittura. | — |
| close-phase0 | [Cross] | E1 | product | Offre workspace multipli, progetti visibili per utente, assegnazioni entità, cockpit con suggerimenti AI, API di piattaforma e matching candidati. | PIANO_GLOBALE_FOLLOWUP_3.md |
| close-phase0-technical-matching-api | [Cross] | E1 | technical | Dettaglio backend del matching: API di scoring, permessi verso le API di piattaforma e ambito workspace allineati al tema padre. | — |
| customer360 | [Cross] | E1 | product | Mostra una scheda cliente unificata con contesto operativo e link rapidi alle entità collegate (trattative, asset, ecc.). | — |
| hc-catalog-templates | [Cross] | E1 | product | Gestione cataloghi master e template di configurazione per progetto, con validazione degli schemi prima del salvataggio. | — |
| matching-be | [Cross] | E1 | product | Espone API che propongono candidati tra clienti e unità con scoring e permessi di lettura coerenti col dominio. | — |
| price-availability | [Cross] | E1 | product | Gestisce listini, calendari prezzo/disponibilità e modelli commerciali collegati a cataloghi HC e inventario. | — |
| projects-legacy-detail | [Cross] | E1 | product | Scheda progetto con dati operativi e correzioni legacy, confronto tra origine storica e stato corrente e policy commerciale per progetto. | — |
| requests-actions-workflow | [Cross] | E1 | product | Azioni sulle trattative oltre al kanban: transizioni governate dal motore di workflow e blocco temporaneo dell’unità nelle operazioni critiche. | — |
| requests-deals | [Cross] | E1 | product | Gestisce trattative in vista kanban o lista con transizioni di stato coerenti sulle richieste commerciali. | — |
| session-project-scope | [Cross] | E1 | product | Guida la scelta dei progetti visibili nella sessione (anche multipli), salva le preferenze e le riallinea quando cambia il workspace. | — |
| workflow-config-ui | [Cross] | E1 | product | Configura stati e transizioni delle trattative per workspace; le definizioni salvate si applicano a tutte le richieste del tenant. | — |
| workspaces-users-admin | [Cross] | E1 | product | Amministrazione workspace e utenti: associazione ai progetti, ruoli nel workspace e operazioni riservate agli admin. | — |
| audit-log-security | [Cross] | E2 | product | Consultazione eventi di audit con filtri, export opzionale e correlazione alle richieste HTTP per analisi e incident response. | — |
| auth-core | [Cross] | E2 | product | Consente login nativo o SSO, refresh token, logout e registrazione eventi di sicurezza sulle sessioni. | — |
| auth-core-technical-mfa-lockout | [Cross] | E2 | technical | Rafforza MFA, tentativi falliti e revoca sessioni oltre al flusso di login principale (TOTP, backup code, lockout). | — |
| keycloak-oidc-sso | [Cross] | E2 | product | Consente il login tramite Identity Provider esterno (OIDC/Keycloak): dopo il callback allinea profilo utente, workspace e ambito progetti con l’app. | — |
| user-access-granularity | [Cross] | E2 | product | Applica RBAC per modulo e azione, override per utente, catalogo permessi via API e audit su membership workspace e progetti. | deliverables/FASE01_USER_ACCESS_RBAC.md |
| big-data-marketing | [Cross] | E3 | product | Offre una pagina di integrazione dati marketing con OAuth, cache e diagnostica (es. GA4) per verificare la configurazione. | — |
| commercial-entitlements | [Cross] | E3 | product | Attiva o disattiva moduli a pagamento per workspace; blocca route platform e invii senza entitlement; vetrina in FE e gestione in console Tecma. | deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md |
| integrations-hub | [Cross] | E3 | product | Centralizza regole di automazione, webhook e integrazioni marketing con configurazione e log eseguiti dal workspace. | — |
| marketing-automation-nurture | [Cross] | E3 | product | Sincronizzazione contatti verso strumenti marketing (es. Mailchimp, ActiveCampaign) con entitlement e gestione errori provider. | — |
| tecma-activation-audit | [Cross] | E3 | product | Consente alla console Tecma di consultare e aggiornare entitlement per workspace e note commerciali, con tracciamento modifiche. | deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md |
| csv-mapping | [Cross] | E4 | product | Importa e allinea clienti, appartamenti e quote da export legacy verso le collezioni operative del dominio; supporta query e migrazione pilota. | deliverables/FASE1_CSV_MAPPING.md |
| mls-feed-import | [Sell] | E4 | product | Importazione feed MLS esterni con normalizzazione unità, deduplicazione e risoluzione conflitti con dati inseriti a mano. | — |
| assets-client-documents | [Cross] | E5 | product | Upload e gestione documenti su clienti e asset con storage su object storage e controllo degli accessi in lettura. | — |
| s3-verify | [Cross] | E5 | product | Gestisce upload e download documenti su S3 con URL presigned e offre diagnostica per verificare bucket e permessi. | deliverables/FASE3_S3_VERIFICATION.md |
| contracts-signatures | [Cross] | E6 | product | Integrazione con provider di firma elettronica, aggiornamento stato pratica tramite webhook verificati e collegamento a trattative e documenti. | — |
| customer-portal-public | [Cross] | E6 | product | Area pubblica separata per il cliente finale: accesso con token o sessione dedicata senza mescolare i dati dell’app broker. | — |
| digital-quote | [Sell] | E6 | product | Crea offerte da trattativa, genera PDF su storage e pubblica una pagina raggiungibile con token (magic link). | deliverables/FASE2_DIGITAL_QUOTE.md |
| quotes-domain-public | [Sell] | E6 | product | Preventivi collegati a trattative e asset, con endpoint pubblici dove previsto e totali allineati al modello dati. | — |
| reports-dashboards | [Cross] | E7 | product | Consente definizioni report, preferiti, condivisione snapshot con link e audit degli accessi in lettura. | deliverables/FASE4_REPORTS_DASHBOARDS.md |
| calendar-events-domain | [Cross] | E8 | product | Calendario con creazione e modifica eventi, integrazione fonti esterne e permessi dedicati; collega eventi a clienti e trattative. | — |
| calendar-sync | [Cross] | E8 | product | Mostra eventi legati a client e request; integra Outlook via OAuth in UI; Gmail e job in roadmap. | deliverables/FASE5_CALENDAR_SYNC.md |
| communications-whatsapp-sms | [Cross] | E9 | product | Invio SMS e messaggistica (es. WhatsApp) rispettando policy di routing, provider configurati e entitlement commerciale. | — |
| connectors-ux | [Cross] | E9 | product | Presenta connettori e automazioni in UI e abilita integrazioni esterne solo se coperte da entitlement. | deliverables/FASE6_CONNECTORS_UX.md |
| webhook-automation-rules | [Cross] | E9 | product | Regole e webhook configurabili con prova manuale, log delle esecuzioni e gestione degli errori di invio. | — |
| email-flows-transactional | [Cross] | E10 | product | Template email transazionali con variabili, anteprima e invio di prova; integrazione con il provider e permessi di gestione dedicati. | — |
| inbox-contract | [Cross] | E10 | product | Definisce tipi di notifica, inbox con empty state e persistenza centralizzata delle notifiche in-app. | deliverables/FASE7_INBOX_CONTRACT.md |
| notifications-domain | [Cross] | E10 | product | Genera notifiche coerenti da calendario, trattative e automazioni e le rende consumabili dall’inbox in-app. | — |
| realtime-bus-ui | [Cross] | E10 | product | Aggiornamenti in tempo reale su liste e report quando è disponibile un canale eventi, con fallback se la connessione cade. | — |
| dialog-drawer-ux | [iTd] | E11 | product | Sostituisce progressivamente i dialog con drawer dove serve più contesto su liste e schede dettaglio. | — |
| pwa-offline-telemetry | [Cross] | E11 | product | Prompt installazione PWA, aggiornamenti, stato della rete e telemetria di navigazione con messaggi chiari in modalità offline. | — |
| refactor-api-layer | [Cross] | E11 | product | Suddivide il client HTTP in moduli per dominio per ridurre file monolitici e migliorare test senza mutare i contratti API. | — |
| ux-liste-card-toggle | [iTd] | E11 | product | Consente di passare tra vista a card e tabella sulle liste principali, salvando la preferenza utente. | — |
| ux-mobile | [Cross] | E11 | product | Rende fruibili su schermi piccoli i flussi CRM critici (breakpoint, tabelle scrollabili, touch target e drawer). | — |
| visual-parity | [iTd] | E11 | product | Avvicina progressivamente l’aspetto delle schermate al design system ITD usando token e componenti condivisi. | deliverables/FASE8_VISUAL_PARITY.md |
| bss-auth-adapter | [Cross] | E12 | product | Adatta l’autenticazione al gateway BSS esterno mappando ruoli e permessi al modello dell’app quando la feature è attiva. | — |
| ci-quality-observability | [QA] | E12 | product | Mantiene pipeline CI, gate di merge, osservabilità (log/trace) e runbook di sicurezza allineati al rilascio. | CI_AND_TEST_GATES.md |
| gdpr-compliance-erasure | [Cross] | E12 | product | Richieste di export o cancellazione dati personali con orchestrazione job e verifica degli esiti per conformità normativa. | — |
| ops-scale-health | [QA] | E12 | product | Endpoint operativi protetti per health, readiness e hook di scalabilità orizzontale in ambiente di orchestrazione. | — |
| platform-api-bss | [Cross] | E12 | product | Governance OpenAPI e merge delle specifiche verso il gateway TECMA-BSS con controlli su ciò che resta esposto. | AUTH_AND_TECMA_BSS_API_REPORT.md |
| platform-api-keys-rate-limit | [Cross] | E12 | product | Chiavi API per integrazioni esterne con scope su workspace e progetti, rate limit e validazione su ogni richiesta. | — |
| privacy-consent-records | [Cross] | E12 | product | Registro consensi privacy con versione informativa, storico e possibilità di esportare le prove richieste. | — |
| product-blueprint-jira-console | [Cross] | E12 | product | Console Tecma per pubblicare su Jira descrizioni e subtask dal catalogo PRD e tenere traccia dello stato di pubblicazione. | — |
| product-blueprint-jira-technical-rest | [Cross] | E12 | technical | Client e formattazione verso Jira (inclusi contenuti ADF) per creare e cercare issue dalla pubblicazione del catalogo. | — |
| ai-cockpit-approvals | [Cross] | E13 | product | Mostra suggerimenti AI nel cockpit, consente esecuzione agente e gestione bozze con approvazioni umane nel loop. | — |
| intelligence-routes | [Cross] | E13 | product | Insight aggregati interni (se abilitati), distinti dal modulo Big Data marketing, con query e permessi dedicati. | — |
| coima-gap-assessment | [Cross] | E14 | product | Valutazione dei gap tra requisiti cliente e capacità della piattaforma, con checklist e export per il commerciale. | — |
| discovery-workflow-product | [Cross] | E14 | product | Pipeline di stati da feedback prodotto a elementi di roadmap, collegata alla pagina Product Discovery. | — |
| executive-overview-strategic | [Cross] | E14 | product | Hub di lettura per CTO/CEO con documentazione architetturale e diagrammi, caricamento on demand e contenuti sanitizzati. | — |
| experimental-hub | [Cross] | E14 | product | Raggruppa funzioni sperimentali sotto route /experimental con accesso riservato agli admin Tecma. | — |
| product-discovery | [Cross] | E14 | product | Raccoglie feedback e idee prodotto in un’area admin dedicata con priorità e tracciamento verso la roadmap. | — |

Vedi anche [CATALOG_FOR_LLM.md](./CATALOG_FOR_LLM.md) per uso con LLM.
