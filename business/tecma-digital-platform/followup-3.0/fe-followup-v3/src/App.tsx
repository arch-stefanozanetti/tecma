import type { ReactNode } from "react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Routes, Route, useLocation, useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { clearProjectScope, loadProjectScope, updateSelectedProjectIds, updateWorkspaceId } from "./auth/projectScope";
import { followupApi } from "./api/followupApi";
import { PageTemplate } from "./core/shared/PageTemplate";
import { PageSimple } from "./core/shared/PageSimple";
import { CalendarPage } from "./core/calendar/CalendarPage";
import { CockpitPage } from "./core/cockpit/CockpitPage";
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
import { SetPasswordFromInvitePage } from "./core/auth/SetPasswordFromInvitePage";
import { ResetPasswordPage } from "./core/auth/ResetPasswordPage";
import { ForgotPasswordPage } from "./core/auth/ForgotPasswordPage";
import { ProjectAccessPage } from "./core/auth/ProjectAccessPage";
import { ApprovalsPage } from "./core/ai/ApprovalsPage";
import { RequestsPage } from "./core/requests/RequestsPage";
import { WorkspacesPage } from "./core/workspaces/WorkspacesPage";
import { UsersPage } from "./core/users/UsersPage";
import { EmailFlowsPage } from "./core/settings/EmailFlowsPage";
import { ProjectDetailPage } from "./core/projects/ProjectDetailPage";
import { AuditLogPage } from "./core/audit/AuditLogPage";
import { ReportsPage } from "./core/reports/ReportsPage";
import { PriceAvailabilityPage } from "./core/prices/PriceAvailabilityPage";
import { ReleasesPage } from "./core/releases/ReleasesPage";
import { IntegrationsPage } from "./core/integrations/IntegrationsPage";
import { ProductDiscoveryPage } from "./core/product-discovery/ProductDiscoveryPage";
import { CustomerPortalPage } from "./core/customer-portal/CustomerPortalPage";
import { ProjectsPage } from "./core/projects/ProjectsPage";
import { InboxPage } from "./core/shared/InboxPage";
import { Customer360Page } from "./core/customer360/Customer360Page";
import { isSectionEnabledByFeature, isPriceAvailabilityRelevant } from "./core/features";
import { CommandPalette } from "./core/shared/CommandPalette";
import type { ProjectAccessProject } from "./types/domain";
import { PwaInstallPrompt } from "./components/pwa/PwaInstallPrompt";
import { PwaUpdatePrompt } from "./components/pwa/PwaUpdatePrompt";
import { NetworkStatusBanner } from "./components/pwa/NetworkStatusBanner";

const ClientDetailPage = lazy(() =>
  import("./core/clients/ClientDetailPage").then((module) => ({ default: module.ClientDetailPage }))
);
const ApartmentDetailPage = lazy(() =>
  import("./core/apartments/ApartmentDetailPage").then((module) => ({ default: module.ApartmentDetailPage }))
);

type Section =
  | "cockpit"
  | "calendar"
  | "clients"
  | "apartments"
  | "requests"
  | "projects"
  | "createApartment"
  | "createApartmentHC"
  | "editApartmentHC"
  | "associateAptClient"
  | "completeFlow"
  | "catalogHC"
  | "templateConfig"
  | "aiApprovals"
  | "workflowConfig"
  | "workspaces"
  | "users"
  | "emailFlows"
  | "audit"
  | "reports"
  | "releases"
  | "integrations"
  | "priceAvailability"
  | "inbox"
  | "customer360"
  | "productDiscovery";

const renderSection = (
  section: Section,
  workspaceId: string,
  projectIds: string[],
  onSectionChange: (s: Section, state?: object) => void,
  projectsForCockpit?: ProjectAccessProject[],
  enabledFeatures?: string[],
  location?: { state?: unknown },
  isAdmin?: boolean,
  navigate?: (path: string) => void
): ReactNode => {
  if (!isSectionEnabledByFeature(section, enabledFeatures)) {
    return (
      <PageSimple title="Funzionalità non disponibile" description="Questa funzionalità non è abilitata per il workspace corrente.">
        <p className="text-sm text-muted-foreground">Contatta l’amministratore per abilitarla.</p>
      </PageSimple>
    );
  }
  if (section === "cockpit") {
    return (
      <PageSimple title="Cosa fare oggi" description="Azioni suggerite e prossimi appuntamenti. Scegli un’azione dalla card o vai al Calendario.">
        <CockpitPage
          workspaceId={workspaceId}
          projectIds={projectIds}
          projects={projectsForCockpit}
          onNavigateToSection={onSectionChange}
          isAdmin={isAdmin ?? false}
        />
      </PageSimple>
    );
  }

  if (section === "calendar") {
    return <CalendarPage />;
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
      <PageSimple title="Configura Flusso Completo" description="Preview + execute sequenziale del flusso completo.">
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

  if (section === "workflowConfig") {
    return (
      <PageSimple title="Configurazione workflow" description="Workflow, stati e transizioni per le trattative (solo admin).">
        <WorkflowConfigPage />
      </PageSimple>
    );
  }

  if (section === "workspaces") {
    return (
      <PageSimple title="Workspaces" description="Gestione workspace e associazioni progetti (solo admin).">
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
      <PageSimple title="Product Discovery" description="Feedback clienti, opportunità, iniziative e feature (solo admin).">
        <ProductDiscoveryPage />
      </PageSimple>
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
      <PageSimple title="Report" description="Pipeline, clienti per stato, appartamenti per disponibilità.">
        <ReportsPage />
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
      <PageSimple title="Prezzi e disponibilità" description="Calendario listini e disponibilità per data, stile backoffice. Clicca su una cella per modificare prezzo e disponibilità.">
        <PriceAvailabilityPage />
      </PageSimple>
    );
  }

  if (section === "releases") {
    return (
      <PageSimple title="Release e novità" description="Cronologia release con nuove funzionalità, correzioni e breaking change.">
        <ReleasesPage />
      </PageSimple>
    );
  }

  if (section === "integrations") {
    return <IntegrationsPage workspaceId={workspaceId} />;
  }

  if (section === "inbox") {
    return (
      <InboxPage
        workspaceId={workspaceId}
        onSectionChange={(s, state) => onSectionChange(s as Section, state)}
        navigate={navigate ?? (() => {})}
      />
    );
  }

  if (section === "customer360") {
    return (
      <Customer360Page
        workspaceId={workspaceId}
        projectIds={projectIds}
        onSectionChange={(s, state) => onSectionChange(s as Section, state)}
        navigate={navigate ?? (() => {})}
      />
    );
  }

  if (section === "projects") {
    return <ProjectsPage />;
  }

  if (section === "apartments") {
    return <ApartmentsPage />;
  }
  return <ApartmentsPage />;
};

const SECTIONS: Section[] = [
  "cockpit", "calendar", "clients", "apartments", "requests", "projects", "inbox", "customer360",
  "createApartment", "createApartmentHC", "editApartmentHC", "associateAptClient",
  "completeFlow", "catalogHC", "templateConfig", "aiApprovals", "workflowConfig", "workspaces", "users", "emailFlows", "audit", "reports", "releases", "integrations", "priceAvailability", "productDiscovery",
];

/** Path puliti per le sezioni principali; le altre restano ?section=X */
const SECTION_TO_PATH: Partial<Record<Section, string>> = {
  cockpit: "/",
  calendar: "/calendar",
  clients: "/clients",
  apartments: "/apartments",
  requests: "/requests",
  projects: "/projects",
  inbox: "/inbox",
  customer360: "/customer-360",
  workflowConfig: "/workflow-config",
  workspaces: "/workspace",
  users: "/users",
  emailFlows: "/email-flows",
  audit: "/audit",
  reports: "/reports",
  releases: "/releases",
  integrations: "/integrations",
  priceAvailability: "/prices",
  productDiscovery: "/product-discovery",
};
const PATH_TO_SECTION: Record<string, Section> = Object.fromEntries(
  (Object.entries(SECTION_TO_PATH) as [Section, string][]).map(([s, p]) => [p, s])
);

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
  }, [projectScope?.workspaceId, accessVersion]);

  // Sezione effettiva: sulle route dettaglio evidenziamo Clienti/Appartamenti in navbar
  const effectiveSection: Section =
    pathname.startsWith("/clients") ? "clients"
    : pathname.startsWith("/apartments") ? "apartments"
    : section;

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
    const scope = projectScopeRef;
    const isTz = isTzWorkspaceRef;
    const filtered = filteredProjectsRef;
    const selected = filteredSelectedRef;
    if (!isTz || selected.length > 0 || filtered.length === 0 || !scope) return;
    const allIds = filtered.map((p) => p.id);
    updateSelectedProjectIds(allIds);
    void followupApi.saveUserPreferences(scope.email ?? "", scope.workspaceId ?? "", allIds).catch(() => {});
    setAccessVersion((v) => v + 1);
  }, [isTzWorkspaceRef, filteredSelectedRef.length, filteredProjectsRef, projectScopeRef?.email, projectScopeRef?.workspaceId]);

  // Click su voce di menu: path pulito quando esiste, altrimenti ?section=X. state per shortcut di flusso (es. apri drawer).
  const onSectionChange = (s: Section, state?: object) => {
    setSection(s);
    const path = SECTION_TO_PATH[s];
    const navState = state ?? {};
    if (path) navigate(path, { state: navState });
    else navigate(`/?section=${s}`, { state: navState });
  };

  if (pathname.startsWith("/set-password")) {
    return <SetPasswordFromInvitePage />;
  }
  if (pathname.startsWith("/portal")) {
    return <CustomerPortalPage />;
  }
  if (pathname.startsWith("/reset-password")) {
    return <ResetPasswordPage />;
  }
  if (pathname.startsWith("/forgot-password")) {
    return <ForgotPasswordPage />;
  }
  if (pathname.includes("/login")) {
    return <LoginPage />;
  }

  const hasAccessToken =
    typeof window !== "undefined" ? window.sessionStorage.getItem("followup3.accessToken") !== null : false;

  if (!hasAccessToken) {
    const currentPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/";
    window.location.replace(`/login?backTo=${encodeURIComponent(currentPath)}`);
    return null;
  }

  if (!projectScope || projectScope.selectedProjectIds.length === 0) {
    return <ProjectAccessPage onCompleted={() => setAccessVersion((v) => v + 1)} />;
  }

  const allProjects = projectScope.projects ?? [];
  const wsIds = workspaceProjectIds;
  const isTzWorkspace = projectScope.workspaceId && !isLegacyWorkspace(projectScope.workspaceId);
  const filteredProjects =
    !isTzWorkspace || wsIds === null || (Array.isArray(wsIds) && wsIds.length === 0)
      ? allProjects
      : allProjects.filter((p) => wsIds.includes(p.id));
  const filteredSelected = projectScope.selectedProjectIds?.filter((id) =>
    filteredProjects.some((p) => p.id === id)
  ) ?? [];

  const templateProps = {
    section: effectiveSection,
    onSectionChange,
    userEmail: projectScope.email,
    workspaceId: projectScope.workspaceId ?? "",
    apiEnvironment: projectScope.apiEnvironment,
    isAdmin: projectScope.isAdmin ?? false,
    enabledFeatures: workspaceFeatures,
    onChangeProjects: () => {
      clearProjectScope();
      setAccessVersion((v) => v + 1);
    },
    onChangeWorkspace: (newWorkspaceId: string) => {
      updateWorkspaceId(newWorkspaceId);
      const isLegacy = isLegacyWorkspace(newWorkspaceId);
      if (isLegacy) {
        void followupApi
          .saveUserPreferences(projectScope.email ?? "", newWorkspaceId, projectScope.selectedProjectIds ?? [])
          .catch(() => {});
      } else {
        followupApi
          .listWorkspaceProjects(newWorkspaceId)
          .then((res) => {
            const newWsProjectIds = (res.data ?? []).map((wp) => wp.projectId);
            const currentSelected = projectScope.selectedProjectIds ?? [];
            const intersection = currentSelected.filter((id) => newWsProjectIds.includes(id));
            const newSelected = intersection.length > 0 ? intersection : newWsProjectIds;
            updateSelectedProjectIds(newSelected);
            return followupApi.saveUserPreferences(projectScope.email ?? "", newWorkspaceId, newSelected);
          })
          .catch(() => {});
      }
      setAccessVersion((v) => v + 1);
    },
    projects: filteredProjects,
    selectedProjectIds: filteredSelected,
    onSelectedProjectIdsChange: (ids: string[]) => {
      updateSelectedProjectIds(ids);
      setAccessVersion((v) => v + 1);
    },
    navigate,
  };

  // Wrapper con key per forzare unmount/remount al cambio sezione (evita "more hooks" su stesso componente).
  const effectiveProjectIds =
    isTzWorkspace && wsIds !== null
      ? filteredSelected
      : (projectScope.selectedProjectIds ?? []);
  const sectionContent = renderSection(
    section,
    projectScope.workspaceId ?? "",
    effectiveProjectIds,
    onSectionChange,
    filteredProjects,
    workspaceFeatures,
    location,
    projectScope.isAdmin ?? false,
    navigate
  );

  return (
    <>
      <NetworkStatusBanner />
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
      />
    <Routes>
      <Route
        path="/clients/:clientId"
        element={
          <PageTemplate {...templateProps}>
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Caricamento dettaglio cliente...</div>}>
              <ClientDetailPage />
            </Suspense>
          </PageTemplate>
        }
      />
      <Route
        path="/apartments/:apartmentId"
        element={
          <PageTemplate {...templateProps}>
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Caricamento dettaglio appartamento...</div>}>
              <ApartmentDetailPage />
            </Suspense>
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
        path="/*"
        element={
          <PageTemplate {...templateProps}>
            <div key={section} className="contents">
              {sectionContent}
            </div>
          </PageTemplate>
        }
      />
    </Routes>
      <PwaInstallPrompt />
      <PwaUpdatePrompt />
    </>
  );
};
