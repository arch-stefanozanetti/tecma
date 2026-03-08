import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { clearProjectScope, loadProjectScope, updateSelectedProjectIds, updateWorkspaceId } from "./auth/projectScope";
import { followupApi } from "./api/followupApi";
import { PageTemplate } from "./core/shared/PageTemplate";
import { ClientDetailPage } from "./core/clients/ClientDetailPage";
import { ApartmentDetailPage } from "./core/apartments/ApartmentDetailPage";
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
import { HCMasterCatalogPage } from "./core/hc/HCMasterCatalogPage";
import { TemplateConfigPage } from "./core/templates/TemplateConfigPage";
import { LoginPage } from "./core/auth/LoginPage";
import { ProjectAccessPage } from "./core/auth/ProjectAccessPage";
import { ApprovalsPage } from "./core/ai/ApprovalsPage";
import { RequestsPage } from "./core/requests/RequestsPage";
import { WorkspacesPage } from "./core/workspaces/WorkspacesPage";
import { ProjectDetailPage } from "./core/projects/ProjectDetailPage";
import { AuditLogPage } from "./core/audit/AuditLogPage";
import { ReportsPage } from "./core/reports/ReportsPage";
import { ReleasesPage } from "./core/releases/ReleasesPage";
import { IntegrationsPage } from "./core/integrations/IntegrationsPage";
import { ProjectsPage } from "./core/projects/ProjectsPage";
import { isSectionEnabledByFeature } from "./core/features";
import type { ProjectAccessProject } from "./types/domain";

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
  | "workspaces"
  | "audit"
  | "reports"
  | "releases"
  | "integrations";

const renderSection = (
  section: Section,
  workspaceId: string,
  projectIds: string[],
  onSectionChange: (s: Section) => void,
  projectsForCockpit?: ProjectAccessProject[],
  enabledFeatures?: string[],
  location?: { state?: unknown }
) => {
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

  if (section === "workspaces") {
    return (
      <PageSimple title="Workspaces" description="Gestione workspace e associazioni progetti (solo admin).">
        <WorkspacesPage />
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

  if (section === "releases") {
    return (
      <PageSimple title="Release e novità" description="Cronologia release con nuove funzionalità, correzioni e breaking change.">
        <ReleasesPage />
      </PageSimple>
    );
  }

  if (section === "integrations") {
    return <IntegrationsPage />;
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
  "cockpit", "calendar", "clients", "apartments", "requests", "projects",
  "createApartment", "createApartmentHC", "editApartmentHC", "associateAptClient",
  "completeFlow", "catalogHC", "templateConfig", "aiApprovals", "workspaces", "audit", "reports", "releases", "integrations",
];

const isLegacyWorkspace = (id: string) => id === "dev-1" || id === "demo" || id === "prod";

export const App = () => {
  const [section, setSection] = useState<Section>("cockpit");
  const [accessVersion, setAccessVersion] = useState(0);
  const [workspaceProjectIds, setWorkspaceProjectIds] = useState<string[] | null>(null);
  const [workspaceFeatures, setWorkspaceFeatures] = useState<string[] | undefined>(undefined);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const projectScope = useMemo(() => loadProjectScope(), [accessVersion]);

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
    if (pathname === "/") {
      const q = searchParams.get("section");
      if (q && SECTIONS.includes(q as Section)) setSection(q as Section);
    }
  }, [pathname, searchParams]);

  // Click su voce di menu: vai sempre a /?section=X così la navbar funziona anche da scheda cliente/appartamento
  const onSectionChange = (s: Section) => {
    setSection(s);
    navigate(`/?section=${s}`);
  };

  if (pathname.includes("/login")) {
    return <LoginPage />;
  }

  const hasAccessToken =
    typeof window !== "undefined" ? window.sessionStorage.getItem("followup3.accessToken") !== null : false;

  if (!hasAccessToken) {
    window.location.replace(`/login?backTo=${encodeURIComponent(window.location.href)}`);
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

  // Se tz_workspace e nessun progetto selezionato ma ci sono progetti nel workspace, seleziona tutti
  useEffect(() => {
    if (!isTzWorkspace || filteredSelected.length > 0 || filteredProjects.length === 0 || !projectScope) return;
    const allIds = filteredProjects.map((p) => p.id);
    updateSelectedProjectIds(allIds);
    void followupApi.saveUserPreferences(projectScope.email ?? "", projectScope.workspaceId ?? "", allIds).catch(() => {});
    setAccessVersion((v) => v + 1);
  }, [isTzWorkspace, filteredSelected.length, filteredProjects, projectScope?.email, projectScope?.workspaceId]);

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
    setSection,
    filteredProjects,
    workspaceFeatures,
    location
  );

  return (
    <Routes>
      <Route
        path="/clients/:clientId"
        element={
          <PageTemplate {...templateProps}>
            <ClientDetailPage />
          </PageTemplate>
        }
      />
      <Route
        path="/apartments/:apartmentId"
        element={
          <PageTemplate {...templateProps}>
            <ApartmentDetailPage />
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
  );
};
