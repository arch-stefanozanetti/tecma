# Legacy -> FollowUp 3.0: Project Gap Matrix

Stato di allineamento dominio **Project** tra database legacy (read-only) e target `tz_*`.

Legenda:
- `OK` = migrato e gestibile end-to-end (read/write in piattaforma)
- `PARZIALE` = presente ma incompleto (solo read, o write non completo, o mapping incompleto)
- `MANCANTE` = non ancora disponibile in target
- `DEPRECATO` = non piu` rilevante nel nuovo modello

## Ambiti coperti

- Identita` progetto
- Contatti e URL
- Legale / privacy
- Branding comunicazioni
- Workflow trattative
- Marketing / big data
- Configurazione tecnica
- Template email/PDF
- Accessi cross-workspace
- Campi custom legati al progetto

## Matrice campi

| Area | Campo legacy | Target FollowUp 3 | Stato | Note operative |
|---|---|---|---|---|
| Identita` | `name` | `tz_projects.name` | OK | Usato in dettaglio progetto |
| Identita` | `displayName` | `tz_projects.displayName` | OK | Usato in UI e topbar |
| Identita` | `mode` (sell/rent) | `tz_projects.mode` | OK | Corretto anche per pilot |
| Identita` | `city` | `tz_projects.city` | OK | Salvataggio disponibile |
| Identita` | `payoff` | `tz_projects.payoff` | OK | Salvataggio disponibile |
| Contatti | `contactEmail` | `tz_projects.contactEmail` | OK | Salvataggio disponibile |
| Contatti | `contactPhone` | `tz_projects.contactPhone` | OK | Salvataggio disponibile |
| Contatti | `projectUrl` | `tz_projects.projectUrl` | OK | Salvataggio disponibile |
| Contatti | `customDomain` | `tz_projects.customDomain` | OK | Salvataggio disponibile |
| Configurazione tecnica | `defaultLang` | `tz_projects.defaultLang` | OK | Salvataggio disponibile |
| Configurazione tecnica | `hostKey` | `tz_projects.hostKey` | OK | Salvataggio disponibile |
| Configurazione tecnica | `assetKey` | `tz_projects.assetKey` | OK | Salvataggio disponibile |
| Configurazione tecnica | `feVendorKey` | `tz_projects.feVendorKey` | OK | Salvataggio disponibile |
| Configurazione tecnica | `automaticQuoteEnabled` | `tz_projects.automaticQuoteEnabled` | OK | Salvataggio disponibile |
| Configurazione tecnica | `accountManagerEnabled` | `tz_projects.accountManagerEnabled` | OK | Salvataggio disponibile |
| Configurazione tecnica | `hasDAS` | `tz_projects.hasDAS` | OK | Salvataggio disponibile |
| Configurazione tecnica | `broker` | `tz_projects.broker` | OK | Salvataggio disponibile |
| Configurazione tecnica | `iban` | `tz_projects.iban` | OK | Salvataggio disponibile |
| Legale/privacy | `privacyPolicyUrl` | `tz_project_policies.privacyPolicyUrl` | OK | Endpoint dedicato presente |
| Legale/privacy | `termsUrl` | `tz_project_policies.termsUrl` | OK | Endpoint dedicato presente |
| Legale/privacy | `content` (inline policy) | `tz_project_policies.content` | OK | Endpoint dedicato presente |
| Legale/privacy | `legalNotes` | `tz_project_policies.legalNotes` | PARZIALE | UI presente, persistenza da allineare |
| Branding | `logoUrl` | `tz_project_branding.logoUrl` | OK | Endpoint dedicato presente |
| Branding | `primaryColor` | `tz_project_branding.primaryColor` | OK | Endpoint dedicato presente |
| Branding | `footerText` | `tz_project_branding.footerText` | OK | Endpoint dedicato presente |
| Workflow | workflow override progetto | `tz_project_workflow_settings.workflowId` | OK | Endpoint dedicato presente |
| Marketing | `googleAdsCustomerId` | `tz_project_marketing_settings.googleAdsCustomerId` | OK | Endpoint dedicato presente |
| Marketing | `googleAdsLoginCustomerId` | `tz_project_marketing_settings.googleAdsLoginCustomerId` | OK | Endpoint dedicato presente |
| Marketing | `ga4PropertyId` | `tz_project_marketing_settings.ga4PropertyId` | OK | Endpoint dedicato presente |
| Marketing | `metaAdAccountId` | `tz_project_marketing_settings.metaAdAccountId` | OK | Endpoint dedicato presente |
| Marketing | `siteHostname` | `tz_project_marketing_settings.siteHostname` | OK | Endpoint dedicato presente |
| Email | SMTP config | `tz_project_email_config` | OK | Endpoint dedicato presente |
| Email | template comunicazioni | `tz_project_email_templates` | OK | CRUD presente |
| PDF | template PDF | `tz_project_pdf_templates` | OK | CRUD presente |
| Accessi | workspace partner + ruolo | `tz_project_access` | OK | CRUD presente |
| Campi custom | additional infos di progetto | non modellato per-project (solo workspace) | PARZIALE | disponibile sezione workspace-level |
| Legacy metadata | snapshot provenienza legacy | `tz_projects.migration` | OK | presente nel pilot |
| Legacy metadata | payload progetto completo legacy | `tz_projects.legacyPayload` | MANCANTE | da aggiungere in ETL/backfill |

## Gap prioritari da chiudere

1. Persistenza `legalNotes` in `tz_project_policies` (UI gia` pronta).
2. Estensione `ProjectDetail` BE per restituire tutti i campi gia` salvabili (`contact*`, `keys`, flags, `broker`, `iban`, metadati migrazione).
3. Backfill ETL progetto per popolare anche blocchi policies/branding/tecnica dai documenti legacy dove disponibili.
4. Tracciamento esplicito dei campi non mappati (`legacyPayload`) per evitare perdita informativa.

## KPI suggeriti

- `% campi progetto legacy mappati` = campi `OK` / campi legacy totali perimetrati.
- `% progetti con payload completo` = progetti con `legacyPayload` e `migration` valorizzati.
- `% errori save/read` su pagina progetto (smoke test pilot).

