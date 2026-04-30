import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart2,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Euro,
  FolderKanban,
  GitBranch,
  Handshake,
  Home,
  Inbox as InboxIcon,
  Layers,
  LogOut,
  Mail,
  Menu,
  Plug,
  Search,
  Settings,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import { NAV_ITEMS, sectionMeetsPermissionRequirements, type Section } from "../config/routes";
import { cn } from "../../lib/utils";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "../../components/ui/sheet";
import logotipoTecma from "../../assets/itd-icons/logotipoTecma.svg";
import { LogoTecma } from "../../components/LogoTecma";
import type { ProjectAccessProject } from "../../types/domain";
import { clearProjectScope, WorkspaceOverrideProvider } from "../../auth/projectScope";
import { followupApi } from "../../api/followupApi";
import { isBssAuth } from "../../api/authApi";
import { clearTokens, getRefreshToken } from "../../api/http";
import { isSectionEnabledByFeature, isPriceAvailabilityRelevant } from "../features";
import { Inbox } from "./Inbox";
import { DevChannelPicker } from "../../dev/DevChannelPicker";

interface PageTemplateProps {
  section: Section;
  onSectionChange: (section: Section, state?: object) => void;
  userEmail: string;
  workspaceId: string;
  /** Ambiente API (dev-1/demo/prod) per banner ambiente */
  apiEnvironment?: "dev-1" | "demo" | "prod";
  isAdmin?: boolean;
  onChangeProjects: () => void;
  onChangeWorkspace?: (workspaceId: string) => void;
  projects: ProjectAccessProject[];
  selectedProjectIds: string[];
  onSelectedProjectIdsChange: (ids: string[]) => void;
  /** Feature abilitate per il workspace corrente (undefined = tutte). Usate per nascondere voci di menu. */
  enabledFeatures?: string[];
  /** Per Inbox: navigazione a path (es. /clients/:id). Se assente, Inbox non è mostrato. */
  navigate?: (path: string) => void;
  /** Gate voci di menu su permesso JWT (es. integrations.read). Admin/`*` ignorati dal chiamante. */
  hasPermission?: (permission: string) => boolean;
  /** Mostra voci riservate a Tecma admin (es. console entitlement). */
  isTecmaAdmin?: boolean;
  children: ReactNode;
}

const mainNav = NAV_ITEMS.filter((item) => item.navGroup === "primary");
const mobileQuickNav: Array<{ id: Section; label: string; icon: React.ElementType }> = [
  { id: "calendar", label: "Agenda", icon: CalendarDays },
  { id: "requests", label: "Follow-up", icon: Handshake },
  { id: "clients", label: "Clienti", icon: Users },
  { id: "apartments", label: "Stato unità", icon: Building2 },
];
const getMainNav = (
  isAdmin: boolean,
  enabledFeatures?: string[],
  hasPermission?: (permission: string) => boolean,
  isTecmaAdmin?: boolean
) =>
  mainNav.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.tecmaAdminOnly || isTecmaAdmin) &&
      isSectionEnabledByFeature(item.id, enabledFeatures) &&
      sectionMeetsPermissionRequirements(item.id, hasPermission)
  );
const getSecondaryNav = (
  isAdmin: boolean,
  enabledFeatures?: string[],
  priceAvailabilityContext?: { projects: ProjectAccessProject[]; selectedProjectIds: string[] },
  hasPermission?: (permission: string) => boolean,
  isTecmaAdmin?: boolean
) =>
  NAV_ITEMS.filter((item) => {
    if (item.navGroup !== "insights" && item.navGroup !== "settings") return false;
    if (item.adminOnly && !isAdmin) return false;
    if (item.tecmaAdminOnly && !isTecmaAdmin) return false;
    if (!isSectionEnabledByFeature(item.id, enabledFeatures)) return false;
    if (!sectionMeetsPermissionRequirements(item.id, hasPermission)) return false;
    if (item.id === "priceAvailability" && priceAvailabilityContext) {
      const { projects, selectedProjectIds } = priceAvailabilityContext;
      if (!isPriceAvailabilityRelevant(projects, selectedProjectIds)) return false;
    }
    if (item.id === "rentRevenue" && priceAvailabilityContext) {
      const { projects, selectedProjectIds } = priceAvailabilityContext;
      if (!isPriceAvailabilityRelevant(projects, selectedProjectIds)) return false;
    }
    return true;
  });

const SideNav = ({
  section,
  onSectionChange,
  isAdmin = false,
  enabledFeatures,
  projects,
  selectedProjectIds,
  collapsed = false,
  onCollapseToggle,
  touchFriendly = false,
  className,
  hasPermission,
  isTecmaAdmin = false,
}: {
  section: Section;
  onSectionChange: (section: Section, state?: object) => void;
  isAdmin?: boolean;
  enabledFeatures?: string[];
  projects: ProjectAccessProject[];
  selectedProjectIds: string[];
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  touchFriendly?: boolean;
  className?: string;
  hasPermission?: (permission: string) => boolean;
  isTecmaAdmin?: boolean;
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const secondaryNav = getSecondaryNav(isAdmin, enabledFeatures, {
    projects,
    selectedProjectIds,
  }, hasPermission, isTecmaAdmin);
  const isSecondaryActive = useMemo(
    () => secondaryNav.some((item) => item.id === section),
    [section, secondaryNav]
  );

  useEffect(() => {
    if (isSecondaryActive) {
      setToolsOpen(true);
    }
  }, [isSecondaryActive]);

  const mainNavBtnCls = cn(
    "relative flex w-full items-center gap-2 rounded-chrome border text-left text-sm font-semibold transition-colors",
    touchFriendly ? "min-h-11 py-3" : "h-10",
    collapsed ? "justify-center px-2" : "px-4"
  );
  const secondaryBtnCls = cn(
    "flex w-full items-center gap-2 rounded-chrome text-left text-xs font-medium transition-colors",
    touchFriendly ? "min-h-11 py-3" : "h-9",
    collapsed ? "justify-center px-2" : "px-3"
  );

  return (
    <aside
      className={cn(
        "relative flex h-full w-full flex-col border-r border-border bg-sidebar-nav shadow-sidebar",
        className
      )}
    >
      <div className={cn("flex justify-center pb-6 pt-10", collapsed ? "px-2" : "px-6")}>
        <LogoTecma className={cn("opacity-85", collapsed ? "h-10 w-10" : "h-24 w-24")} />
      </div>

      <div className={cn("flex-1 min-h-0 overflow-y-auto pt-5 pb-5", collapsed ? "px-2" : "px-6")}>
        {onCollapseToggle && (
          <div className={cn("mb-8 flex justify-end", collapsed ? "mb-4" : "")}>
            <button
              type="button"
              onClick={onCollapseToggle}
              aria-label={collapsed ? "Expand menu" : "Collapse menu"}
              className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>
        )}

        <nav className={cn("space-y-4", collapsed && "space-y-2")}>
          {getMainNav(isAdmin, enabledFeatures, hasPermission, isTecmaAdmin).map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  mainNavBtnCls,
                  isActive
                    ? "border-transparent bg-background text-primary shadow-sidebar-nav-active"
                    : "border-transparent bg-white/15 text-muted-foreground shadow-sidebar-nav hover:bg-white/30"
                )}
              >
                {isActive && !collapsed && <span className="absolute -left-3 top-0 h-full w-0.5 bg-primary" />}
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {collapsed && <span className="sr-only">{item.label}</span>}
              </button>
            );
          })}

          {secondaryNav.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setToolsOpen((value) => !value)}
                title={collapsed ? "Esplora e imposta" : undefined}
                className={cn(
                  mainNavBtnCls,
                  "border-0",
                  isSecondaryActive
                    ? "bg-white/25 text-muted-foreground shadow-sidebar-nav"
                    : "bg-white/15 text-muted-foreground shadow-sidebar-nav hover:bg-white/25"
                )}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="flex-1">Esplora e imposta</span>}
                <ChevronDown className={cn("h-4 w-4 flex-shrink-0 transition-transform", toolsOpen && "rotate-180")} />
                {collapsed && <span className="sr-only">Esplora e imposta</span>}
              </button>

              {toolsOpen && collapsed && (
                <div className="space-y-1">
                  {secondaryNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = section === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSectionChange(item.id)}
                        title={item.label}
                        className={cn(
                          "flex min-h-9 w-full items-center justify-center rounded-chrome transition-colors",
                          isActive
                            ? "bg-background text-primary shadow-sidebar-nav-active"
                            : "bg-white/15 text-muted-foreground hover:bg-white/30"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="sr-only">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {toolsOpen && !collapsed && (
                <div className="space-y-4 pl-3">
                  {(() => {
                    const insightsItems = secondaryNav.filter((item) => item.navGroup === "insights");
                    const settingsItems = secondaryNav.filter((item) => item.navGroup === "settings");
                    const renderNavList = (items: typeof secondaryNav) =>
                      items.map((item) => {
                        const Icon = item.icon;
                        const isActive = section === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSectionChange(item.id)}
                            className={cn(
                              secondaryBtnCls,
                              isActive
                                ? "bg-background text-primary shadow-sidebar-nav-active"
                                : "bg-white/15 text-muted-foreground shadow-sidebar-nav hover:bg-white/30"
                            )}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      });
                    return (
                      <>
                        {insightsItems.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Analisi
                            </p>
                            {renderNavList(insightsItems)}
                          </div>
                        )}
                        {settingsItems.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Impostazioni
                            </p>
                            {renderNavList(settingsItems)}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </nav>

      </div>

      <div className="p-6 pt-10">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Powered by</span>
          <img src={logotipoTecma} alt="TECMA" className="h-[11px] w-20 object-contain opacity-85" />
        </div>
      </div>
    </aside>
  );
};

// ── Workspace Selector ────────────────────────────────────────────────────────
const LEGACY_WS_LABELS: Record<string, string> = { "dev-1": "Dev-1", demo: "Demo", prod: "Production" };

const WorkspaceSelector = ({
  workspaceId,
  onChangeWorkspace,
}: {
  workspaceId: string;
  onChangeWorkspace: (workspaceId: string) => void;
}) => {
  const [workspaces, setWorkspaces] = useState<{ _id: string; name?: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    followupApi.listWorkspaces().then((list) => setWorkspaces(Array.isArray(list) ? list : [])).catch(() => setWorkspaces([]));
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const label = workspaces.length > 0
    ? (workspaces.find((w) => w._id === workspaceId)?.name ?? workspaceId)
    : (LEGACY_WS_LABELS[workspaceId] ?? workspaceId);

  const options = workspaces.length > 0
    ? workspaces
    : [{ _id: "dev-1", name: "Dev-1" }, { _id: "demo", name: "Demo" }, { _id: "prod", name: "Production" }];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-chrome border px-3 text-sm transition-colors",
          open
            ? "border-primary bg-sidebar-accent text-primary"
            : "border-border bg-background text-foreground hover:bg-muted"
        )}
        title="Select workspace"
      >
        <FolderKanban className="h-3.5 w-3.5" />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-ui border border-border bg-card shadow-dropdown">
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace
            </span>
          </div>
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option._id}
                type="button"
                onClick={() => {
                  onChangeWorkspace(option._id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted",
                  workspaceId === option._id && "bg-sidebar-accent text-primary"
                )}
              >
                {option.name ?? option._id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Project Selector ──────────────────────────────────────────────────────────
const ProjectSelector = ({
  workspaceId,
  projects,
  selectedProjectIds,
  onSelectedProjectIdsChange,
}: {
  workspaceId: string;
  projects: ProjectAccessProject[];
  selectedProjectIds: string[];
  onSelectedProjectIdsChange: (ids: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    // Rebind forte: quando cambia workspace o set progetti, chiudi il dropdown.
    setOpen(false);
  }, [workspaceId, projects]);

  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const name = (p.displayName ?? p.name ?? "").toLowerCase();
      const id = p.id.toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [projects, searchQuery]);

  const toggle = (id: string) => {
    const next = selectedProjectIds.includes(id)
      ? selectedProjectIds.filter((p) => p !== id)
      : [...selectedProjectIds, id];
    // must keep at least 1 project selected
    if (next.length === 0) return;
    onSelectedProjectIdsChange(next);
  };

  const selectAll = () => {
    onSelectedProjectIdsChange(projects.map((p) => p.id));
  };

  /** Resta un solo progetto attivo (il primo tra quelli selezionati) — vincolo minimo 1 selezione. */
  const deselectAllButOne = () => {
    if (projects.length <= 1) return;
    if (selectedProjectIds.length <= 1) return;
    onSelectedProjectIdsChange([selectedProjectIds[0]]);
  };

  const allSelected = projects.length > 0 && selectedProjectIds.length === projects.length;
  const canDeselectBulk = projects.length > 1 && selectedProjectIds.length > 1;

  const label =
    selectedProjectIds.length === projects.length
      ? `All projects`
      : selectedProjectIds.length === 1
        ? (projects.find((p) => p.id === selectedProjectIds[0])?.displayName ?? "1 project")
        : `${selectedProjectIds.length} projects`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-chrome border px-3 text-sm transition-colors",
          open
            ? "border-primary bg-sidebar-accent text-primary"
            : "border-border bg-background text-foreground hover:bg-muted"
        )}
        title="Select active projects"
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 flex w-[min(100vw-2rem,20rem)] max-w-[20rem] flex-col overflow-hidden rounded-ui border border-border bg-card shadow-dropdown">
          <div className="border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active projects
            </span>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per nome o ID…"
                className="h-9 pl-8 text-sm"
                autoComplete="off"
                aria-label="Filtra progetti"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={allSelected || projects.length === 0}
                className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
              >
                Seleziona tutti
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                type="button"
                onClick={deselectAllButOne}
                disabled={!canDeselectBulk}
                title={
                  canDeselectBulk
                    ? "Lascia attivo solo il primo tra i progetti selezionati (serve almeno un progetto)"
                    : undefined
                }
                className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
              >
                Deseleziona tutti
              </button>
            </div>
          </div>

          <div className="max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain py-1">
            {filteredProjects.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Nessun progetto corrisponde.</p>
            ) : (
              filteredProjects.map((project) => {
                const isSelected = selectedProjectIds.includes(project.id);
                return (
                  <div
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(project.id);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(project.id)}
                        size="sm"
                        aria-label={project.displayName || project.name}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{project.displayName || project.name}</span>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {String(project.mode ?? "").toLowerCase() === "rent" ? "Rent" : "Sell"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const PageTemplate = ({
  section,
  onSectionChange,
  userEmail,
  workspaceId,
  apiEnvironment,
  isAdmin = false,
  onChangeProjects,
  onChangeWorkspace,
  projects,
  selectedProjectIds,
  onSelectedProjectIdsChange,
  enabledFeatures,
  navigate,
  hasPermission,
  isTecmaAdmin = false,
  children,
}: PageTemplateProps) => {
  const sidebarStorageKey = `followup.sidebarCollapsed${workspaceId ? `.${workspaceId}` : ""}`;
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(sidebarStorageKey) === "true";
    } catch {
      return false;
    }
  });
  const setSidebarCollapsed = useCallback(
    (update: boolean | ((prev: boolean) => boolean)) => {
      setSidebarCollapsedState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        try {
          localStorage.setItem(sidebarStorageKey, String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [sidebarStorageKey]
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userName = userEmail?.split("@")[0]?.replace(/[._-]/g, " ") || "Mario Rossi";

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const refreshToken = getRefreshToken();
    const doRedirect = () => {
      clearTokens();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("followup3.lastEmail");
        window.sessionStorage.removeItem("followup3.permLastSync");
        clearProjectScope();
        window.location.href = "/login";
      }
    };
    if (refreshToken) {
      followupApi.logout(refreshToken).catch(() => {}).finally(doRedirect);
    } else {
      doRedirect();
    }
  };

  const handleMobileSectionChange = (s: Section) => {
    onSectionChange(s);
    setMobileNavOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-app font-body text-foreground" data-testid="tecma-templatePage">
      <div className={cn("hidden lg:block flex-shrink-0 transition-[width]", sidebarCollapsed ? "w-16" : "w-64")}>
        <SideNav
          section={section}
          onSectionChange={onSectionChange}
          isAdmin={isAdmin}
          enabledFeatures={enabledFeatures}
          projects={projects}
          selectedProjectIds={selectedProjectIds}
          collapsed={sidebarCollapsed}
          onCollapseToggle={() => setSidebarCollapsed((v) => !v)}
          hasPermission={hasPermission}
          isTecmaAdmin={isTecmaAdmin}
        />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="fixed left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-chrome border border-border bg-background text-foreground shadow-sm lg:hidden"
            aria-label="Apri menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[290px] border-none p-0">
          <SideNav
            section={section}
            onSectionChange={handleMobileSectionChange}
            isAdmin={isAdmin}
            enabledFeatures={enabledFeatures}
            projects={projects}
            selectedProjectIds={selectedProjectIds}
            touchFriendly
            className="h-full"
            hasPermission={hasPermission}
            isTecmaAdmin={isTecmaAdmin}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-[72px] items-center justify-end border-b border-border bg-background px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <DevChannelPicker compact className="hidden min-[400px]:block" />

            {/* Workspace selector (admin) */}
            {isAdmin && onChangeWorkspace && (
              <WorkspaceSelector workspaceId={workspaceId} onChangeWorkspace={onChangeWorkspace} />
            )}

            {/* Project selector */}
            {projects.length > 0 && (
              <ProjectSelector
                key={`project-selector-${workspaceId}`}
                workspaceId={workspaceId}
                projects={projects}
                selectedProjectIds={selectedProjectIds}
                onSelectedProjectIdsChange={onSelectedProjectIdsChange}
              />
            )}

            {/* Inbox (notifiche) */}
            {navigate && (
              <Inbox
                workspaceId={workspaceId}
                onSectionChange={(section, state) => onSectionChange(section as Section, state)}
                navigate={navigate}
              />
            )}

            {/* Settings */}
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-chrome border border-border bg-background px-3 text-sm text-foreground hover:bg-muted"
              >
                <Settings className="h-3.5 w-3.5" />
                Impostazioni
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-12 w-48 overflow-hidden rounded-ui border border-border bg-card shadow-dropdown">
                  {[
                    { label: "Progetti", icon: Building2, section: "projects" as Section },
                    { label: "Integrazioni", icon: Plug, section: "integrations" as Section },
                    { label: "Sicurezza account", icon: Shield, section: "accountSecurity" as Section },
                  ].map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.label}
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false);
                          onSectionChange(entry.section);
                        }}
                        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                title={userEmail}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-chrome border px-2 text-sm transition-colors",
                  userMenuOpen
                    ? "border-primary bg-sidebar-accent text-primary"
                    : "border-transparent bg-transparent text-foreground hover:bg-muted"
                )}
              >
                <UserCircle className="h-4 w-4" />
                <span className="max-w-[120px] truncate">{userName}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", userMenuOpen && "rotate-180")} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-ui border border-border bg-card shadow-dropdown">
                  <div className="border-b border-border px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Account
                    </span>
                    <p className="mt-1 truncate text-sm text-foreground" title={userEmail}>
                      {userEmail}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onChangeProjects();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <Layers className="h-4 w-4" />
                      Cambia progetti
                    </button>
                    {!isBssAuth() && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onSectionChange("accountSecurity");
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                      >
                        <Shield className="h-4 w-4" />
                        Sicurezza (MFA)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" />
                      Esci
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {(apiEnvironment === "dev-1" || workspaceId === "dev-1") && (
          <div className="relative z-10 w-full bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
            Ambiente di sviluppo – non produzione
          </div>
        )}
        {(apiEnvironment === "demo" || workspaceId === "demo") && (
          <div className="relative z-10 w-full bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-amber-950">
            Ambiente Demo – non produzione
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-auto pb-16 lg:pb-0">
          <WorkspaceOverrideProvider
            value={{
              workspaceId,
              selectedProjectIds,
              projects,
            }}
          >
            {children}
          </WorkspaceOverrideProvider>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {mobileQuickNav.map((item) => {
              if (!isSectionEnabledByFeature(item.id, enabledFeatures)) return null;
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-chrome px-2 text-[11px] font-medium",
                    active ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <footer className="flex shrink-0 items-center justify-end gap-4 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => onSectionChange("howItWorks")}
            className="hover:text-foreground hover:underline"
          >
            Come funziona
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onSectionChange("audit")}
              className="hover:text-foreground hover:underline"
            >
              Audit log
            </button>
          )}
          <button
            type="button"
            onClick={() => onSectionChange("releases")}
            className="hover:text-foreground hover:underline"
          >
            Novità di prodotto
          </button>
        </footer>
      </div>
    </div>
  );
};
