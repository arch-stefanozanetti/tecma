/**
 * Diagrammi Mermaid per la tab "Panoramica visiva" (leadership / CTO).
 * Mix di tipi: mindmap, sequence, sankey, pie, xychart, quadrant, journey — non solo flowchart TB.
 */
export interface ExecutiveDiagram {
  id: string;
  title: string;
  description?: string;
  chart: string;
}

export const EXECUTIVE_DIAGRAMS: ExecutiveDiagram[] = [
  {
    id: "product-context",
    title: "Contesto prodotto",
    description: "Mappa mentale: canali verso dati e integrazioni.",
    chart: `mindmap
  root((Utenti_CRM))
    Browser_SPA
      REST_API_v1
        MongoDB_tz
    Integrazioni_BE
      Twilio_Marketing
      Email_SES
    Accesso
      SSO_o_JWT`,
  },
  {
    id: "tenant-workspace",
    title: "Multi-tenant e workspace",
    description: "Gerarchia organizzativa (mindmap).",
    chart: `mindmap
  root((Organizzazione))
    Workspace_tenant
      Progetti_CRM
        Utenti_assegnati
      Utenti_workspace
        Ruoli_RBAC
      Condivisione
        Project_access_cross_ws`,
  },
  {
    id: "rbac-jwt",
    title: "RBAC e richiesta autenticata",
    description: "Sequenza richiesta → guard → handler.",
    chart: `sequenceDiagram
  participant C as Client_FE_BE
  participant J as JWT
  participant G as Guard
  participant H as Handler
  C->>G: Richiesta_con_Bearer
  G->>J: Verifica_token
  J-->>G: Claims_capability
  alt Permesso_OK
    G->>H: Esegui
    H-->>C: 200
  else Negato
    G-->>C: 403
  end`,
  },
  {
    id: "entitlement-connectors",
    title: "Entitlement e connettori",
    description: "Flusso volumi Platform → workspace → fornitori (Sankey).",
    chart: `sankey-beta

Platform_API,API_key_scope,1
API_key_scope,Connector_config,1
Connector_config,Email_marketing,1
Connector_config,Voice_SMS,1
Connector_config,Altri_vendor,1`,
  },
  {
    id: "crm-entities",
    title: "CRM core — entità",
    description: "Relazioni tra aggregate (class diagram).",
    chart: `classDiagram
  class Workspace
  class Progetto
  class ClienteCRM
  class Appartamento
  class Richiesta
  Workspace "1" --> "*" Progetto : contiene
  Progetto "1" --> "*" Appartamento : catalogo
  ClienteCRM "1" --> "*" Richiesta : apre
  Appartamento "1" --> "*" Richiesta : oggetto`,
  },
  {
    id: "gdpr-flow",
    title: "Privacy e flussi dati",
    description: "Ripartizione attenzione su categorie (grafico a torta qualitativo).",
    chart: `pie showData
    title Filoni dati e compliance alto livello
    "Trattamento_operativo_CRM" : 45
    "Account_e_permessi" : 25
    "Audit_e_log" : 15
    "Export_retention_roadmap" : 15`,
  },
  {
    id: "domain-maturity",
    title: "Cluster — stadio operativo",
    description: "Avanzamento indicativo per macro-area (scala 1–5 qualitativa; vedi tab Stadio in doc 03).",
    chart: `xychart-beta
    title "Avanzamento indicativo per cluster"
    x-axis [Fondamenta, Prodotto, Integrazioni, Ops, Roadmap]
    y-axis "Livello" 0 --> 5
    bar [4, 4, 3, 4, 2]`,
  },
  {
    id: "cicd-deploy",
    title: "CI e deploy",
    description: "Timeline semplificata dalla commit al runtime.",
    chart: `timeline
    title Da codice a produzione
    section Source
        Git_push_MR : Commit_e_review
    section Quality
        GitHub_Actions : Build_e_test
        Semgrep_Trivy : Security_scan
    section Release
        Render_deploy : Artefatto_in_esecuzione
        Node_runtime : API_e_worker`,
  },
];
