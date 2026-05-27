import type { ReactNode } from "react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Routes, Route, useLocation, useSearchParams, useNavigate, Navigate, useParams } from "react-router-dom";
import { clearProjectScope, loadProjectScope, saveProjectScope, updateSelectedProjectIds } from "./auth/projectScope";
import { followupApi } from "./api/followupApi";
import { getRefreshToken, setTokens } from "./api/http";
import { isBssAuth } from "./api/authApi";
import { getKeycloakCallbackPath } from "./auth/keycloakOidc";
import { spaAbsolutePath } from "./lib/spaPath";
import { PageTemplate } from "./core/shared/PageTemplate";
import { PageSimple } from "./core/shared/PageSimple";
import { ClientsPage } from "./core/clients/ClientsPage";
import { ApartmentsPage } from "./core/apartments/ApartmentsPage";
import { CreateApartmentPage } from "./core/apartments/CreateApartmentPage";
import { CreateApartmentHCPage } from "./core/hc/CreateApartmentHCPage";
import { EditApartmentHCPage } from "./core/hc/EditApartmentHCPage";
import { AssociateAptClientPage } from "./core/associations/AssociateAptClientPage";
import { CompleteFlowPage } from "./core/workflows/CompleteFlowPage";
import { WorkflowConfigPage } from "./core/workflows/WorkflowConfigPage";
import { HCMasterCatalogPage } from "./core/hc/HCMasterCatalogPage";
import { TemplateConfigPage } from "./core/templates/TemplateConfigPage";
import { LoginPage } from "./core/auth/LoginPage";
import { KeycloakCallbackPage } from "./core/auth/KeycloakCallbackPage";
import { AccountSecurityPage } from "./core/auth/AccountSecurityPage";
import { SetPasswordFromInvitePage } from "./core/auth/SetPasswordFromInvitePage";
import { ResetPasswordPage } from "./core/auth/ResetPasswordPage";
import { ForgotPasswordPage } from "./core/auth/ForgotPasswordPage";
import { isPublicAppRoute } from "./core/auth/publicRoutes";
import { isLegacyWorkspaceId } from "./core/auth/workspaceSessionId";
import { ProjectAccessPage } from "./core/auth/ProjectAccessPage";
import { ApprovalsPage } from "./core/ai/ApprovalsPage";
import { RequestsPage } from "./core/requests/RequestsPage";
import { WorkspacesPage } from "./core/workspaces/WorkspacesPage";
import { UsersPage } from "./core/users/UsersPage";
import { EmailFlowsPage } from "./core/settings/EmailFlowsPage";
import { ProjectDetailPage } from "./core/projects/ProjectDetailPage";
import { AuditLogPage } from "./core/audit/AuditLogPage";
import { SharedReportPage } from "./core/reports/SharedReportPage";
import { TecmaEntitlementsPage } from "./core/integrations/TecmaEntitlementsPage";
import { ProductBlueprintPage } from "./core/tecma/ProductBlueprintPage";
import { ExperimentalHubPage } from "./core/experimental/ExperimentalHubPage";
import { ExperimentalExperimentPage } from "./core/experimental/ExperimentalExperimentPage";
import { isSectionEnabledByFeature, isPriceAvailabilityRelevant } from "./core/features";
import {
  SECTIONS,
  SECTION_TO_PATH,
  PATH_TO_SECTION,
  sectionMeetsPermissionRequirements,
  sectionRequiredPermissionHint,
  type Section,
} from "./core/config/routes";
import { CommandPalette } from "./core/shared/CommandPalette";
import type { ProjectAccessProject } from "./types/domain";
import { PwaInstallPrompt } from "./components/pwa/PwaInstallPrompt";
import { PwaUpdatePrompt } from "./components/pwa/PwaUpdatePrompt";
import { NetworkStatusBanner } from "./components/pwa/NetworkStatusBanner";
import { ProductTelemetryBridge } from "./telemetry/ProductTelemetryBridge";

const ClientDetailPage = lazy(() =>
  import("./core/clients/ClientDetailPage").then((module) => ({ default: module.ClientDetailPage }))
);
const ApartmentDetailPage = lazy(() =>
  import("./core/apartments/ApartmentDetailPage").then((module) => ({ default: module.ApartmentDetailPage }))
);
const ExecutiveOverviewPage = lazy(() =>
  import("./core/executive/ExecutiveOverviewPage").then((module) => ({ default: module.ExecutiveOverviewPage }))
);
const CalendarPage = lazy(() =>
  import("./core/calendar/CalendarPage").then((module) => ({ default: module.CalendarPage }))
);
const CockpitPage = lazy(() =>
  import("./core/cockpit/CockpitPage").then((module) => ({ default: module.CockpitPage }))
);
const ReportsPage = lazy(() =>
  import("./core/reports/ReportsPage").then((module) => ({ default: module.ReportsPage }))
);
const RentRevenuePage = lazy(() =>
  import("./core/reports/RentRevenuePage").then((module) => ({ default: module.RentRevenuePage }))
);
const BigDataPage = lazy(() =>
  import("./core/bigdata/BigDataPage").then((module) => ({ default: module.BigDataPage }))
);
const HowItWorksPage = lazy(() =>
  import("./core/help/HowItWorksPage").then((module) => ({ default: module.HowItWorksPage }))
);
const IntegrationsPage = lazy(() =>
  import("./core/integrations/IntegrationsPage").then((module) => ({ default: module.IntegrationsPage }))
);
const ReleasesPage = lazy(() =>
  import("./core/releases/ReleasesPage").then((module) => ({ default: module.ReleasesPage }))
);
const ProjectsPage = lazy(() =>
  import("./core/projects/ProjectsPage").then((module) => ({ default: module.ProjectsPage }))
);
const InboxPage = lazy(() =>
  import("./core/shared/InboxPage").then((module) => ({ default: module.InboxPage }))
);
const Customer360Page = lazy(() =>
  import("./core/customer360/Customer360Page").then((module) => ({ default: module.Customer360Page }))
);
const CoimaGapPage = lazy(() =>
  import("./core/coima/CoimaGapPage").then((module) => ({ default: module.CoimaGapPage }))
);
const CustomerPortalPage = lazy(() =>
  import("./core/customer-portal/CustomerPortalPage").then((module) => ({ default: module.CustomerPortalPage }))
);
const ProductDiscoveryPage = lazy(() =>
  import("./core/product-discovery/ProductDiscoveryPage").then((module) => ({ default: module.ProductDiscoveryPage }))
);
const PriceAvailabilityPage = lazy(() =>
  import("./core/prices/PriceAvailabilityPage").then((module) => ({ default: module.PriceAvailabilityPage }))
);

const LazySectionFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted-foreground">Caricamento…</div>
);

function ExperimentalRouteContent({
  isTecmaAdmin,
  editorUrl,
}: {
  isTecmaAdmin: boolean;
  editorUrl: string;
}): ReactNode {
  const { experimentId } = useParams<{ experimentId: string }>();
  if (!isTecmaAdmin) {
    return (
      <PageSimple title="Accesso negato" description="Solo superadmin Tecma possono aprire l'area Experimental.">
        <p className="text-sm text-muted-foreground">Verifica il ruolo sull'account o contatta Tecma.</p>
      </PageSimple>
    );
  }
  return <ExperimentalExperimentPage experimentId={experimentId} editorUrl={editorUrl} />;
}

function PermissionGated({
  permission,
  hasPermission,
  children,
}: {
  permission: string | readonly string[];
  hasPermission: (perm: string) => boolean;
  children: ReactNode;
}): ReactNode {
  const list = typeof permission === "string" ? [permission] : [...permission];
  const ok = list.every((p) => hasPermission(p));
  if (ok) return <>{children}</>;
  const hint = list.join(" + ");
  return (
    <PageSimple title="Accesso negato" description="Non hai i permessi per questa risorsa.">
      <p className="text-sm text-muted-foreground">
        Servono: <span className="font-mono text-xs">{hint}</span>. Effettua logout/login se i ruoli sono stati aggiornati.
      </p>
    </PageSimple>
  );
}

const renderSection = (
  section: Section,
  workspaceId: string,
  projectIds: string[],
  onSectionChange: (s: Section, state?: object) => void,
  projectsForCockpit?: ProjectAccessProject[],
  enabledFeatures?: string[],
  location?: { state?: unknown },
  isAdmin?: boolean,
  navigate?: (path: string) => void,
  hasPermission?: (perm: string) => boolean,
  isTecmaAdmin?: boolean
): ReactNode => {
  if (!isSectionEnabledByFeature(section, enabledFeatures)) {
    return (
      <PageSimple title="Funzionalità non disponibile" description="Questa funzionalità non è abilitata per il workspace corrente.">
        <p className="text-sm text-muted-foreground">Contatta l’amministratore per abilitarla.</p>
      </PageSimple>
    );
  }
  if (hasPermission && !sectionMeetsPermissionRequirements(section, hasPermission)) {
    const hint = sectionRequiredPermissionHint(section);
    return (
      <PageSimple title="Accesso negato" description="Non hai i permessi per questa sezione.">
        <p className="text-sm text-muted-foreground">
          {hint ? (
            <>
              Permessi richiesti: <span className="font-mono text-xs">{hint}</span>.
            </>
          ) : (
            "Contatta un amministratore."
          )}{" "}
          Se i ruoli sono cambiati, effettua logout e login (o attendi il refresh automatico del token).
        </p>
      </PageSimple>
    );
  }
  if (section === "cockpit") {
    return (
      <PageSimple title="Cosa fare oggi" description="Azioni suggerite e prossimi appuntamenti. Scegli un’azione dalla card o vai al Calendario.">
        <Suspense fallback={<LazySectionFallback />}>
          <CockpitPage
            workspaceId={workspaceId}
            projectIds={projectIds}
            projects={projectsForCockpit}
            onNavigateToSection={onSectionChange}
            isAdmin={isAdmin ?? false}
          />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "howItWorks") {
    return (
      <PageSimple
        title="Come funziona"
        description="Una guida rapida ai flussi principali di FollowUp: da progetto e inventario fino alla trattativa."
      >
        <Suspense fallback={<LazySectionFallback />}>
          <HowItWorksPage onSectionChange={onSectionChange} />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "calendar") {
    return (
      <Suspense fallback={<LazySectionFallback />}>
        <CalendarPage />
      </Suspense>
    );
  }

  if (section === "clients") {
    return <ClientsPage />;
  }

  if (section === "requests") {
    return <RequestsPage />;
  }

  if (section === "createApartment") {
    return (
      <PageSimple title="Crea Appartamento" description="Wizard 3 step con creazione apartment e CTA verso HC.">
        <CreateApartmentPage workspaceId={workspaceId} projectIds={projectIds} />
      </PageSimple>
    );
  }

  if (section === "createApartmentHC") {
    return (
      <PageSimple title="Crea Appartamento HC" description="Selezione apartment + sezione + form values + salvataggio HC.">
        <CreateApartmentHCPage workspaceId={workspaceId} projectIds={projectIds} />
      </PageSimple>
    );
  }

  if (section === "editApartmentHC") {
    const editApartmentId = (location?.state as { editApartmentId?: string } | null)?.editApartmentId;
    return (
      <PageSimple title="Modifica Appartamento HC" description="Edit mode con caricamento configurazione HC esistente.">
        <EditApartmentHCPage workspaceId={workspaceId} projectIds={projectIds} initialApartmentId={editApartmentId} />
      </PageSimple>
    );
  }

  if (section === "associateAptClient") {
    const assocState = (location?.state as { clientId?: string; apartmentId?: string; status?: string } | null) ?? {};
    return (
      <PageSimple title="Associa Apt/Cliente" description="Associazione cliente-appartamento con status proposta/compromesso/rogito.">
        <AssociateAptClientPage
          workspaceId={workspaceId}
          projectIds={projectIds}
          onNavigateToSection={(s) => onSectionChange(s as Section)}
          initialClientId={assocState.clientId}
          initialApartmentId={assocState.apartmentId}
          initialStatus={assocState.status as "proposta" | "compromesso" | "rogito" | undefined}
        />
      </PageSimple>
    );
  }

  if (section === "completeFlow") {
    return (
      <PageSimple title="Flusso completo" description="Anteprima ed esecuzione guidata dei passaggi principali della trattativa.">
        <CompleteFlowPage workspaceId={workspaceId} projectIds={projectIds} />
      </PageSimple>
    );
  }

  if (section === "catalogHC") {
    return (
      <PageSimple title="Catalogo HC" description="Tabs entity HC con query e CRUD base su catalogo master.">
        <HCMasterCatalogPage workspaceId={workspaceId} projectIds={projectIds} />
      </PageSimple>
    );
  }

  if (section === "templateConfig") {
    return (
      <PageSimple title="Template Config" description="Editor template JSON con validate/save/load per progetto.">
        <TemplateConfigPage workspaceId={workspaceId} projectIds={projectIds} />
      </PageSimple>
    );
  }

  if (section === "aiApprovals") {
    return (
      <PageSimple title="AI Approval Queue" description="Coda approvazioni per azioni suggerite dall'AI.">
        <ApprovalsPage workspaceId={workspaceId} projectIds={projectIds} />
      </PageSimple>
    );
  }

  if (section === "tecmaEntitlements") {
    if (!isTecmaAdmin) {
      return (
        <PageSimple title="Accesso negato" description="Solo amministratori Tecma possono gestire gli entitlement per workspace.">
          <p className="text-sm text-muted-foreground">Verifica il ruolo sull’account o contatta Tecma.</p>
        </PageSimple>
      );
    }
    return (
      <PageSimple title="Entitlement workspace" description="Attiva o sospendi moduli commerciali e UI per ogni workspace (audit sul backend).">
        <TecmaEntitlementsPage workspaceId={workspaceId} isTecmaAdmin />
      </PageSimple>
    );
  }

  if (section === "productBlueprint") {
    if (!isTecmaAdmin) {
      return (
        <PageSimple title="Accesso negato" description="Solo amministratori Tecma possono aprire Product Blueprint e pubblicare su Jira.">
          <p className="text-sm text-muted-foreground">Verifica il ruolo sull’account o contatta Tecma.</p>
        </PageSimple>
      );
    }
    return (
      <PageSimple
        title="Product Blueprint (Jira)"
        description="Catalogo funzionalità Followup 3.0: seleziona le righe, anteprima testi PRD, pubblica Story e sub-task su Jira, sincronizza lo stato."
      >
        <ProductBlueprintPage />
      </PageSimple>
    );
  }

  if (section === "workflowConfig") {
    return (
      <PageSimple title="Workflow" description="Configura stati e transizioni delle trattative per il workspace (solo admin).">
        <WorkflowConfigPage />
      </PageSimple>
    );
  }

  if (section === "workspaces") {
    return (
      <PageSimple title="Workspace" description="Gestisci workspace, associazioni progetto e impostazioni organizzative (solo admin).">
        <WorkspacesPage />
      </PageSimple>
    );
  }

  if (section === "users") {
    return (
      <PageSimple title="Utenti" description="Elenco utenti con visibilità e associazioni (solo admin).">
        <UsersPage />
      </PageSimple>
    );
  }

  if (section === "emailFlows") {
    return <EmailFlowsPage />;
  }

  if (section === "productDiscovery") {
    return (
      <PageSimple title="Product Discovery" description="Area interna per feedback, opportunità e iniziative di prodotto (solo admin).">
        <Suspense fallback={<LazySectionFallback />}>
          <ProductDiscoveryPage />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "experimental") {
    if (!isTecmaAdmin) {
      return (
        <PageSimple title="Accesso negato" description="Solo superadmin Tecma possono aprire l'area Experimental.">
          <p className="text-sm text-muted-foreground">Verifica il ruolo sull'account o contatta Tecma.</p>
        </PageSimple>
      );
    }
    return (
      <PageSimple
        title="Experimental"
        description="Area sperimentale riservata ai superadmin Tecma. Le funzionalita qui presenti possono cambiare o essere rimosse."
      >
        <ExperimentalHubPage onOpenExperiment={(experimentId) => navigate?.(`/experimental/${experimentId}`)} />
      </PageSimple>
    );
  }

  if (section === "executiveOverview") {
    if (!isAdmin) {
      return (
        <PageSimple
          title="Accesso negato"
          description="Solo amministratori workspace possono aprire la panoramica strategica per CTO e CEO."
        >
          <p className="text-sm text-muted-foreground">Verifica il ruolo sull’account o contatta un amministratore.</p>
        </PageSimple>
      );
    }
    return (
      <PageSimple
        title="Panoramica strategica (CTO / CEO)"
        description="Hub introduttivo con percorsi di lettura, mappe Mermaid e testi executive da repository — per allineare direzione, maturità tecnica e rischi prima di pitch o go-live."
      >
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Caricamento panoramica strategica…</div>}>
          <ExecutiveOverviewPage />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "coima") {
    if (!isAdmin) {
      return (
        <PageSimple
          title="Accesso negato"
          description="Solo amministratori workspace possono aprire l’assessment COIMA / BTS."
        >
          <p className="text-sm text-muted-foreground">Verifica il ruolo sull’account o contatta un amministratore.</p>
        </PageSimple>
      );
    }
    return (
      <Suspense fallback={<LazySectionFallback />}>
        <CoimaGapPage />
      </Suspense>
    );
  }

  if (section === "audit") {
    return (
      <PageSimple title="Audit log" description="Tracciamento CRUD su clienti, appartamenti, richieste, associazioni.">
        <AuditLogPage />
      </PageSimple>
    );
  }

  if (section === "reports") {
    return (
      <PageSimple title="Report" description="Viste aggregate su pipeline, clienti, appartamenti e andamento operativo.">
        <Suspense fallback={<LazySectionFallback />}>
          <ReportsPage />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "rentRevenue") {
    if (!isPriceAvailabilityRelevant(projectsForCockpit ?? [], projectIds)) {
      return (
        <PageSimple
          title="Ricavi affitti"
          description="Questa vista è pensata per i progetti in modalità affitto."
        >
          <p className="text-sm text-muted-foreground">
            Seleziona almeno un progetto rent nello scope in alto oppure apri un workspace con inventario affitti.
          </p>
        </PageSimple>
      );
    }
    return (
      <PageSimple
        title="Ricavi affitti"
        description="MRR stimato da canoni mensili sulle unità locate e valore delle trattative affitto chiuse nel periodo."
      >
        <Suspense fallback={<LazySectionFallback />}>
          <RentRevenuePage />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "bigData") {
    return (
      <PageSimple title="Analisi marketing avanzate" description="Funnel marketing + CRM e stato dei connettori Ads, GA4 e Meta.">
        <Suspense fallback={<LazySectionFallback />}>
          <BigDataPage />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "priceAvailability") {
    if (!isPriceAvailabilityRelevant(projectsForCockpit ?? [], projectIds)) {
      return (
        <PageSimple
          title="Prezzi e disponibilità"
          description="In contesto vendita questa vista non è disponibile. Usa il Calendario per appuntamenti e scadenze."
        >
          <p className="text-sm text-muted-foreground">
            La matrice prezzi e disponibilità per data è pensata per l’affitto. Per le unità in vendita puoi usare il <strong>Calendario</strong> per gestire appuntamenti e scadenze.
          </p>
        </PageSimple>
      );
    }
    return (
      <PageSimple title="Prezzi e disponibilità" description="Gestisci listini e disponibilità per data in una vista unica, rapida da aggiornare.">
        <Suspense fallback={<LazySectionFallback />}>
          <PriceAvailabilityPage />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "releases") {
    return (
      <PageSimple title="Novità di prodotto" description="Cronologia release con nuove funzionalità, correzioni e aggiornamenti importanti.">
        <Suspense fallback={<LazySectionFallback />}>
          <ReleasesPage />
        </Suspense>
      </PageSimple>
    );
  }

  if (section === "zeus") {
    return (
      <Suspense fallback={<LazySectionFallback />}>
        <IntegrationsPage workspaceId={workspaceId} initialTab="zeus" />
      </Suspense>
    );
  }

  if (section === "integrations") {
    return (
      <Suspense fallback={<LazySectionFallback />}>
        <IntegrationsPage workspaceId={workspaceId} />
      </Suspense>
    );
  }

  if (section === "inbox") {
    return (
      <Suspense fallback={<LazySectionFallback />}>
        <InboxPage
          workspaceId={workspaceId}
          onSectionChange={(s, state) => onSectionChange(s as Section, state)}
          navigate={navigate ?? (() => {})}
        />
      </Suspense>
    );
  }

  if (section === "customer360") {
    return (
      <Suspense fallback={<LazySectionFallback />}>
        <Customer360Page
          workspaceId={workspaceId}
          projectIds={projectIds}
          onSectionChange={(s, state) => onSectionChange(s as Section, state)}
          navigate={navigate ?? (() => {})}
        />
      </Suspense>
    );
  }

  if (section === "projects") {
    return (
      <Suspense fallback={<LazySectionFallback />}>
        <ProjectsPage />
      </Suspense>
    );
  }

  if (section === "accountSecurity") {
    return (
      <PageSimple title="Sicurezza account" description="Autenticazione a due fattori (TOTP) e codici di backup.">
        <AccountSecurityPage />
      </PageSimple>
    );
  }

  if (section === "apartments") {
    return <ApartmentsPage />;
  }
  return <ApartmentsPage />;
};

const isLegacyWorkspace = (id: string) => id === "dev-1" || id === "demo" || id === "prod";

export const App = () => {
  const [section, setSection] = useState<Section>("cockpit");
  const [accessVersion, setAccessVersion] = useState(0);
  const [workspaceProjectIds, setWorkspaceProjectIds] = useState<string[] | null>(null);
  const [workspaceFeatures, setWorkspaceFeatures] = useState<string[] | undefined>(undefined);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const projectScope = useMemo(() => loadProjectScope(), [accessVersion]);

  /** Allinea permessi in localStorage con JWT aggiornato (dopo deploy RBAC / refresh ruoli). */
  useEffect(() => {
    if (isPublicAppRoute(pathname)) return;
    if (!projectScope?.selectedProjectIds?.length || !projectScope.email) return;
    if (isBssAuth()) return;
    const SYNC_KEY = "followup3.permLastSync";
    const INTERVAL_MS = 4 * 60 * 60 * 1000;
    const last = Number(sessionStorage.getItem(SYNC_KEY) || 0);
    if (Date.now() - last < INTERVAL_MS) return;
    const rt = getRefreshToken();
    if (!rt) return;

    let cancelled = false;
    void (async () => {
      try {
        const r = await followupApi.refresh(rt);
        setTokens(r.accessToken, r.refreshToken ?? rt);
        const u = await followupApi.me();
        if (cancelled) return;
        const cur = loadProjectScope();
        if (cur?.email) {
          saveProjectScope({
            ...cur,
            permissions: u.permissions ?? [],
            isTecmaAdmin: u.isTecmaAdmin === true,
          });
          setAccessVersion((v) => v + 1);
        }
        sessionStorage.setItem(SYNC_KEY, String(Date.now()));
      } catch {
        /* non bloccare: token scaduto o rete */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, projectScope?.selectedProjectIds?.length, projectScope?.email]);

  /** Permessi effettivi per progetto attivo (tz_user_project_access + membership). */
  useEffect(() => {
    if (isPublicAppRoute(pathname)) return;
    const scope = loadProjectScope();
    const wid = scope?.workspaceId?.trim();
    const pid = scope?.selectedProjectIds?.[0];
    if (!wid || !pid || isLegacyWorkspaceId(wid)) return;
    let cancelled = false;
    void followupApi
      .getEffectiveAccess(wid, pid)
      .then((res) => {
        if (cancelled || !res.data) return;
        const cur = loadProjectScope();
        if (!cur) return;
        saveProjectScope({ ...cur, permissions: res.data.permissions ?? [] });
        setAccessVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, projectScope?.workspaceId, projectScope?.selectedProjectIds?.[0]]);

  /** Corregge sessioni con workspaceId legacy (demo/dev-1/prod) salvato al posto dell'id Mongo. */
  useEffect(() => {
    if (isPublicAppRoute(pathname)) return;
    const scope = loadProjectScope();
    if (!scope?.email || !isLegacyWorkspaceId(scope.workspaceId)) return;

    let cancelled = false;
    void (async () => {
      try {
        const access = await followupApi.getProjectsByEmail(scope.email);
        const mongoWs = access.defaultWorkspaceId?.trim();
        if (!mongoWs || isLegacyWorkspaceId(mongoWs) || cancelled) return;
        saveProjectScope({ ...scope, workspaceId: mongoWs });
        await followupApi.saveUserPreferences(scope.email, mongoWs, scope.selectedProjectIds);
        if (!cancelled) setAccessVersion((v) => v + 1);
      } catch {
        /* rete o sessione scaduta */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, accessVersion, projectScope?.workspaceId, projectScope?.email]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (pathname.includes("/login")) return;
        if (typeof window !== "undefined" && window.sessionStorage.getItem("followup3.accessToken") == null) return;
        const scope = loadProjectScope();
        if (!scope || (scope.selectedProjectIds?.length ?? 0) === 0) return;
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pathname]);

  // Carica progetti del workspace quando è un tz_workspace (per filtrare)
  useEffect(() => {
    if (isPublicAppRoute(pathname)) return;
    if (!projectScope?.workspaceId) return;
    const ws = projectScope.workspaceId;
    if (isLegacyWorkspace(ws)) {
      setWorkspaceProjectIds(null);
      setWorkspaceFeatures(undefined);
      return;
    }
    setWorkspaceProjectIds(null);
    followupApi
      .listWorkspaceProjects(ws)
      .then((res) => setWorkspaceProjectIds((res.data ?? []).map((wp) => wp.projectId)))
      .catch(() => setWorkspaceProjectIds([]));
    followupApi
      .getWorkspaceById(ws)
      .then((res) => setWorkspaceFeatures(res.workspace?.features))
      .catch(() => setWorkspaceFeatures(undefined));
  }, [pathname, projectScope?.workspaceId, accessVersion]);

  // Sezione effettiva: pathname esatto da PATH_TO_SECTION (sync con useEffect); su "/" solo `section` per ?section=
  const effectiveSection: Section =
    pathname === "/" || pathname === ""
      ? section
      : PATH_TO_SECTION[pathname] ??
        (pathname.startsWith("/clients") ? "clients"
        : pathname.startsWith("/apartments") ? "apartments"
        : pathname.startsWith("/projects") ? "projects"
        : pathname.startsWith("/experimental") ? "experimental"
        : pathname.startsWith("/coima") ? "coima"
        : pathname.startsWith("/zeus") ? "zeus"
        : section);

  useEffect(() => {
    if (pathname.startsWith("/clients")) {
      setSection("clients");
      return;
    }
    if (pathname.startsWith("/apartments")) {
      setSection("apartments");
      return;
    }
    if (pathname.startsWith("/projects")) {
      setSection("projects");
      return;
    }
    if (pathname.startsWith("/experimental")) {
      setSection("experimental");
      return;
    }
    if (pathname.startsWith("/coima")) {
      setSection("coima");
      return;
    }
    if (pathname.startsWith("/zeus")) {
      setSection("zeus");
      return;
    }
    if (pathname === "/account/security") {
      setSection("accountSecurity");
      return;
    }
    if (pathname === "/" || pathname === "") {
      const q = searchParams.get("section");
      if (q && SECTIONS.includes(q as Section)) {
        setSection(q as Section);
        return;
      }
    }
    const fromPath = PATH_TO_SECTION[pathname];
    if (fromPath) {
      setSection(fromPath);
      return;
    }
  }, [pathname, searchParams]);

  // Se tz_workspace e nessun progetto selezionato ma ci sono progetti nel workspace, seleziona tutti.
  // Eseguito sempre (stesso numero di hook) ma con early return interno per evitare "Rendered more hooks".
  const projectScopeRef = useMemo(() => projectScope, [projectScope]);
  const isTzWorkspaceRef = useMemo(
    () => !!(projectScope?.workspaceId && !isLegacyWorkspace(projectScope.workspaceId)),
    [projectScope?.workspaceId]
  );
  const filteredProjectsRef = useMemo(() => {
    if (!projectScopeRef) return [];
    const wsIds = workspaceProjectIds;
    const isTz = isTzWorkspaceRef;
    const allProjects = projectScopeRef.projects ?? [];
    if (!isTz || wsIds === null || (Array.isArray(wsIds) && wsIds.length === 0)) return allProjects;
    return allProjects.filter((p) => wsIds.includes(p.id));
  }, [projectScopeRef, workspaceProjectIds, isTzWorkspaceRef]);
  const filteredSelectedRef = useMemo(
    () =>
      projectScopeRef?.selectedProjectIds?.filter((id) => filteredProjectsRef.some((p) => p.id === id)) ?? [],
    [projectScopeRef?.selectedProjectIds, filteredProjectsRef]
  );
  useEffect(() => {
    if (isPublicAppRoute(pathname)) return;
    const scope = projectScopeRef;
    const isTz = isTzWorkspaceRef;
    const filtered = filteredProjectsRef;
    const selected = filteredSelectedRef;
    const canAutoSelectAll =
      scope?.isAdmin === true || scope?.isTecmaAdmin === true;
    if (!canAutoSelectAll) return;
    if (!isTz || selected.length > 0 || filtered.length === 0 || !scope) return;
    const allIds = filtered.map((p) => p.id);
    updateSelectedProjectIds(allIds);
    void followupApi.saveUserPreferences(scope.email ?? "", scope.workspaceId ?? "", allIds).catch(() => {});
    setAccessVersion((v) => v + 1);
  }, [pathname, isTzWorkspaceRef, filteredSelectedRef.length, filteredProjectsRef, projectScopeRef?.email, projectScopeRef?.workspaceId]);

  // Click su voce di menu: path pulito quando esiste, altrimenti ?section=X. state per shortcut di flusso (es. apri drawer).
  const onSectionChange = (s: Section, state?: object) => {
    setSection(s);
    const path = SECTION_TO_PATH[s];
    const navState = state ?? {};
    if (path) navigate(path, { state: navState });
    else navigate(`/?section=${s}`, { state: navState });
  };

  let appContent: ReactNode = null;

  if (pathname.startsWith("/set-password")) {
    appContent = <SetPasswordFromInvitePage />;
  } else if (pathname.startsWith("/r/")) {
    appContent = <SharedReportPage />;
  } else if (pathname.startsWith("/portal")) {
    appContent = (
      <Suspense fallback={<LazySectionFallback />}>
        <CustomerPortalPage />
      </Suspense>
    );
  } else if (pathname.startsWith("/reset-password")) {
    appContent = <ResetPasswordPage />;
  } else if (pathname.startsWith("/forgot-password")) {
    appContent = <ForgotPasswordPage />;
  } else if (pathname === getKeycloakCallbackPath() || pathname.startsWith(`${getKeycloakCallbackPath()}/`)) {
    appContent = <KeycloakCallbackPage />;
  } else if (pathname.includes("/login")) {
    appContent = <LoginPage />;
  } else {
    const hasAccessToken =
      typeof window !== "undefined" ? window.sessionStorage.getItem("followup3.accessToken") !== null : false;

    if (!hasAccessToken) {
      const currentPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : "/";
      const loginHref = `${spaAbsolutePath("/login")}?backTo=${encodeURIComponent(currentPath)}`;
      window.location.replace(loginHref);
      appContent = null;
    } else if (!projectScope || projectScope.selectedProjectIds.length === 0) {
      appContent = <ProjectAccessPage onCompleted={() => setAccessVersion((v) => v + 1)} />;
    } else {
      const allProjects = projectScope.projects ?? [];
      const wsIds = workspaceProjectIds;
      const isTzWorkspace = projectScope.workspaceId && !isLegacyWorkspace(projectScope.workspaceId);
      const filteredProjectsRaw =
        !isTzWorkspace || wsIds === null || (Array.isArray(wsIds) && wsIds.length === 0)
          ? allProjects
          : allProjects.filter((p) => wsIds.includes(p.id));
      const allowProjectFallback = projectScope.isAdmin === true || projectScope.isTecmaAdmin === true;
      const filteredProjects =
        filteredProjectsRaw.length === 0 && allProjects.length > 0 && allowProjectFallback
          ? allProjects
          : filteredProjectsRaw;
      const filteredSelectedRaw = projectScope.selectedProjectIds?.filter((id) =>
        filteredProjects.some((p) => p.id === id)
      ) ?? [];
      const filteredSelected =
        filteredSelectedRaw.length === 0 && filteredProjects.length > 0 && allowProjectFallback
          ? filteredProjects.map((p) => p.id)
          : filteredSelectedRaw.length > 0
            ? filteredSelectedRaw
            : filteredProjects.length === 1
              ? [filteredProjects[0]!.id]
              : filteredSelectedRaw;

      const templateProps = {
        section: effectiveSection,
        onSectionChange,
        userEmail: projectScope.email,
        workspaceId: projectScope.workspaceId ?? "",
        apiEnvironment: projectScope.apiEnvironment,
        isAdmin: projectScope.isAdmin ?? false,
        isTecmaAdmin: projectScope.isTecmaAdmin === true,
        enabledFeatures: workspaceFeatures,
        onChangeProjects: () => {
          clearProjectScope();
          setAccessVersion((v) => v + 1);
        },
        onChangeWorkspace: (newWorkspaceId: string) => {
          const targetWorkspaceId = newWorkspaceId.trim();
          const currentScope = loadProjectScope();
          if (!currentScope?.email || !targetWorkspaceId) return;
          // hard reset: invalida subito scope precedente per evitare contaminazioni tra workspace.
          clearProjectScope();
          setWorkspaceProjectIds(null);
          setWorkspaceFeatures(undefined);
          setAccessVersion((v) => v + 1);
          const isLegacy = isLegacyWorkspace(newWorkspaceId);
          if (isLegacy) {
            const selected = currentScope.selectedProjectIds ?? [];
            saveProjectScope({
              ...currentScope,
              workspaceId: targetWorkspaceId,
              selectedProjectIds: selected,
            });
            void followupApi
              .saveUserPreferences(currentScope.email, targetWorkspaceId, selected)
              .catch(() => {});
            setAccessVersion((v) => v + 1);
          } else {
            void Promise.all([
              followupApi.getProjectsByEmail(currentScope.email, targetWorkspaceId),
              followupApi.listWorkspaceProjects(targetWorkspaceId).catch(() => ({ data: [] })),
            ])
              .then(([projectAccess, workspaceProjects]) => {
                const wsProjectIds = (workspaceProjects.data ?? []).map((wp) => wp.projectId);
                const serverProjects = projectAccess.projects ?? [];
                const allowProjectFallback = projectAccess.isAdmin === true;
                const filteredProjects =
                  wsProjectIds.length === 0
                    ? serverProjects
                    : serverProjects.filter((p) => wsProjectIds.includes(p.id));
                const normalizedProjects =
                  filteredProjects.length > 0 || !allowProjectFallback
                    ? filteredProjects
                    : serverProjects;
                const newSelected = normalizedProjects.map((p) => p.id);
                saveProjectScope({
                  ...currentScope,
                  role: projectAccess.role,
                  isAdmin: projectAccess.isAdmin,
                  workspaceId: targetWorkspaceId,
                  projects: normalizedProjects,
                  selectedProjectIds: newSelected,
                });
                updateSelectedProjectIds(newSelected);
                void followupApi
                  .me()
                  .then((u) => {
                    const cur = loadProjectScope();
                    if (!cur?.email) return;
                    saveProjectScope({
                      ...cur,
                      permissions: u.permissions ?? cur.permissions,
                      isAdmin: u.isAdmin ?? cur.isAdmin,
                      isTecmaAdmin: u.isTecmaAdmin === true,
                    });
                    setAccessVersion((v) => v + 1);
                  })
                  .catch(() => {});
                return followupApi.saveUserPreferences(currentScope.email, targetWorkspaceId, newSelected);
              })
              .catch(() => {});
            setAccessVersion((v) => v + 1);
          }
        },
        projects: filteredProjects,
        selectedProjectIds: filteredSelected,
        onSelectedProjectIdsChange: (ids: string[]) => {
          updateSelectedProjectIds(ids);
          setAccessVersion((v) => v + 1);
        },
        navigate,
        hasPermission: (perm: string) => {
          if (projectScope.isAdmin) return true;
          const g = projectScope.permissions ?? [];
          if (g.includes("*")) return true;
          return g.includes(perm);
        },
      };

      // Wrapper con key per forzare unmount/remount al cambio sezione (evita "more hooks" su stesso componente).
      const effectiveProjectIds =
        filteredSelected.length > 0
          ? filteredSelected
          : (projectScope.selectedProjectIds ?? []);
      const sectionContent = renderSection(
        effectiveSection,
        projectScope.workspaceId ?? "",
        effectiveProjectIds,
        onSectionChange,
        filteredProjects,
        workspaceFeatures,
        location,
        projectScope.isAdmin ?? false,
        navigate,
        templateProps.hasPermission,
        projectScope.isTecmaAdmin === true
      );

      appContent = (
        <>
          <ProductTelemetryBridge
            pathname={pathname}
            effectiveSection={effectiveSection}
            workspaceId={projectScope.workspaceId ?? ""}
          />
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onSelectSection={(s) => {
              onSectionChange(s);
              setCommandPaletteOpen(false);
            }}
            navigate={navigate}
            workspaceId={projectScope.workspaceId ?? ""}
            projectIds={effectiveProjectIds}
            enabledFeatures={workspaceFeatures}
            isAdmin={projectScope.isAdmin ?? false}
            projects={filteredProjects}
            selectedProjectIds={filteredSelected}
            hasPermission={(perm: string) => {
              if (projectScope.isAdmin) return true;
              const g = projectScope.permissions ?? [];
              if (g.includes("*")) return true;
              return g.includes(perm);
            }}
          />
          <Routes>
            <Route
              path="/clients/:clientId"
              element={
                <PageTemplate {...templateProps}>
                  <PermissionGated permission="clients.read" hasPermission={templateProps.hasPermission ?? (() => false)}>
                    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Caricamento dettaglio cliente...</div>}>
                      <ClientDetailPage />
                    </Suspense>
                  </PermissionGated>
                </PageTemplate>
              }
            />
            <Route
              path="/apartments/:apartmentId"
              element={
                <PageTemplate {...templateProps}>
                  <PermissionGated permission="apartments.read" hasPermission={templateProps.hasPermission ?? (() => false)}>
                    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Caricamento dettaglio appartamento...</div>}>
                      <ApartmentDetailPage />
                    </Suspense>
                  </PermissionGated>
                </PageTemplate>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <PageTemplate {...templateProps}>
                  <ProjectDetailPage />
                </PageTemplate>
              }
            />
            <Route path="/automations" element={<Navigate to="/integrations?tab=regole" replace />} />
            <Route
              path="/experimental/:experimentId"
              element={
                <PageTemplate {...templateProps}>
                  <ExperimentalRouteContent
                    isTecmaAdmin={projectScope.isTecmaAdmin === true}
                    editorUrl={import.meta.env.VITE_EXPERIMENTAL_EDITOR_URL?.trim() || "/experimental/editor"}
                  />
                </PageTemplate>
              }
            />
            <Route
              path="/*"
              element={
                <PageTemplate {...templateProps}>
                  <div key={effectiveSection} className="contents">
                    {sectionContent}
                  </div>
                </PageTemplate>
              }
            />
          </Routes>
        </>
      );
    }
  }


  return (
    <>
      {appContent}
      <NetworkStatusBanner />
      <PwaInstallPrompt />
      <PwaUpdatePrompt />
    </>
  );
};
