import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart2,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Handshake,
  Home,
  Layers,
  LogOut,
  Menu,
  Plug,
  Search,
  Settings,
  Shield,
  UserCircle,
  Users,
} from 'lucide-react';

import logotipoTecma from '../assets/logotipoTecma.svg?url';
import { LogoTecma } from '../components/LogoTecma';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { WorkspaceManagementPage } from '../features/organization/WorkspaceManagementPage';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import type { ProjectAccessProject } from '../features/projects/ProjectAccessPage';
import { http } from '../lib/http';
import { cn } from '../lib/utils';

export type AppSection =
  | 'cockpit'
  | 'clients'
  | 'apartments'
  | 'requests'
  | 'calendar'
  | 'customer360'
  | 'reports'
  | 'projects'
  | 'workspaces'
  | 'integrations'
  | 'accountSecurity';

interface PageTemplateProps {
  accessToken: string;
  children: ReactNode;
}

interface WorkspacesResponse {
  data: Array<{ _id: string; name?: string }>;
}

const PRIMARY_NAV: Array<{ id: AppSection; label: string; icon: typeof Home }> = [
  { id: 'cockpit', label: 'Home', icon: Home },
  { id: 'clients', label: 'Clienti', icon: Users },
  { id: 'apartments', label: 'Appartamenti', icon: Building2 },
  { id: 'requests', label: 'Trattative', icon: Handshake },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
];

const INSIGHTS_NAV: Array<{ id: AppSection; label: string; icon: typeof BarChart2 }> = [
  { id: 'customer360', label: 'Customer 360', icon: UserCircle },
  { id: 'reports', label: 'Report', icon: BarChart2 },
];

const SETTINGS_NAV: Array<{ id: AppSection; label: string; icon: typeof Plug }> = [
  { id: 'workspaces', label: 'Workspace management', icon: FolderKanban },
  { id: 'projects', label: 'Progetti', icon: Building2 },
  { id: 'integrations', label: 'Integrazioni', icon: Plug },
  { id: 'accountSecurity', label: 'Sicurezza account', icon: Shield },
];

const mobileQuickNav: Array<{ id: AppSection; label: string; icon: typeof CalendarDays }> = [
  { id: 'calendar', label: 'Agenda', icon: CalendarDays },
  { id: 'requests', label: 'Follow-up', icon: Handshake },
  { id: 'clients', label: 'Clienti', icon: Users },
  { id: 'apartments', label: 'Stato unità', icon: Building2 },
];

function readProjectsFromSession(): ProjectAccessProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem('followup3.projectsCache');
    if (raw == null) return [];
    const parsed = JSON.parse(raw) as ProjectAccessProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSelectedIds(projects: ProjectAccessProject[]): string[] {
  if (typeof window === 'undefined') return projects.map((p) => p.id);
  try {
    const raw = window.sessionStorage.getItem('followup.projectScope');
    if (raw == null) return projects.map((p) => p.id);
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : projects.map((p) => p.id);
  } catch {
    return projects.map((p) => p.id);
  }
}

const WorkspaceSelector = ({
  workspaceId,
  onChangeWorkspace,
  accessToken,
}: {
  workspaceId: string;
  onChangeWorkspace: (id: string) => void;
  accessToken: string;
}) => {
  const [workspaces, setWorkspaces] = useState<{ _id: string; name?: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void http<WorkspacesResponse>('/workspaces', { method: 'GET', accessToken })
      .then((r) => setWorkspaces(Array.isArray(r.data) ? r.data : []))
      .catch(() => setWorkspaces([]));
  }, [accessToken]);

  useEffect(() => {
    if (workspaceId.trim() !== '' || workspaces.length === 0) return;
    const firstWorkspaceId = workspaces[0]?._id;
    if (firstWorkspaceId == null || firstWorkspaceId.trim() === '') return;
    onChangeWorkspace(firstWorkspaceId);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('followup.workspaceId', firstWorkspaceId);
    }
  }, [workspaceId, workspaces, onChangeWorkspace]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current != null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedWorkspace = workspaces.find((w) => w._id === workspaceId);
  const label = selectedWorkspace?.name ?? selectedWorkspace?._id ?? 'Workspace';
  const options = workspaces;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-chrome border px-3 text-sm transition-colors',
          open
            ? 'border-primary bg-sidebar-accent text-primary'
            : 'border-border bg-background text-foreground hover:bg-muted',
        )}
        title="Select workspace"
      >
        <FolderKanban className="h-3.5 w-3.5" />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-ui border border-border bg-card shadow-dropdown">
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace
            </span>
          </div>
          <div className="py-1">
            {options.length === 0 ? (
              <p className="px-4 py-2.5 text-sm text-muted-foreground">Nessun workspace disponibile</p>
            ) : null}
            {options.map((option) => (
              <button
                key={option._id}
                type="button"
                onClick={() => {
                  onChangeWorkspace(option._id);
                  setOpen(false);
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem('followup.workspaceId', option._id);
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted',
                  workspaceId === option._id && 'bg-sidebar-accent text-primary',
                )}
              >
                {option.name ?? option._id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ProjectSelector = ({
  projects,
  selectedProjectIds,
  onSelectedProjectIdsChange,
  workspaceId,
}: {
  workspaceId: string;
  projects: ProjectAccessProject[];
  selectedProjectIds: string[];
  onSelectedProjectIdsChange: (ids: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current != null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [workspaceId, projects]);

  useEffect(() => {
    if (!open) setSearchQuery('');
  }, [open]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const name = (p.displayName ?? p.name ?? '').toLowerCase();
      const id = p.id.toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [projects, searchQuery]);

  const toggle = (id: string) => {
    const next = selectedProjectIds.includes(id)
      ? selectedProjectIds.filter((p) => p !== id)
      : [...selectedProjectIds, id];
    if (next.length === 0) return;
    onSelectedProjectIdsChange(next);
  };

  const selectAll = () => {
    onSelectedProjectIdsChange(projects.map((p) => p.id));
  };

  const deselectAllButOne = () => {
    if (projects.length <= 1) return;
    if (selectedProjectIds.length <= 1) return;
    const first = selectedProjectIds[0];
    if (first == null) return;
    onSelectedProjectIdsChange([first]);
  };

  const allSelected = projects.length > 0 && selectedProjectIds.length === projects.length;
  const canDeselectBulk = projects.length > 1 && selectedProjectIds.length > 1;

  const label =
    selectedProjectIds.length === projects.length
      ? 'All projects'
      : selectedProjectIds.length === 1
        ? (projects.find((p) => p.id === selectedProjectIds[0])?.displayName ?? '1 project')
        : `${selectedProjectIds.length} projects`;

  if (projects.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-chrome border px-3 text-sm transition-colors',
          open
            ? 'border-primary bg-sidebar-accent text-primary'
            : 'border-border bg-background text-foreground hover:bg-muted',
        )}
        title="Select active projects"
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
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
                className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
              >
                Deseleziona tutti
              </button>
            </div>
          </div>

          <div className="max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain py-1">
            {filteredProjects.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Nessun progetto corrisponde.
              </p>
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
                      if (e.key === 'Enter' || e.key === ' ') {
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
                    <span className="min-w-0 flex-1 truncate">
                      {project.displayName || project.name}
                    </span>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {String(project.mode ?? '').toLowerCase() === 'rent' ? 'Rent' : 'Sell'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SideNav = ({
  section,
  onSectionChange,
  isAdmin = false,
  collapsed = false,
  onCollapseToggle,
  touchFriendly = false,
  className,
}: {
  section: AppSection;
  onSectionChange: (section: AppSection) => void;
  isAdmin?: boolean;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  touchFriendly?: boolean;
  className?: string;
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const secondaryNav = useMemo(
    () => [
      ...INSIGHTS_NAV,
      ...SETTINGS_NAV.filter((item) => item.id === 'workspaces' || isAdmin),
    ],
    [isAdmin],
  );
  const isSecondaryActive = useMemo(
    () => secondaryNav.some((item) => item.id === section),
    [section, secondaryNav],
  );

  useEffect(() => {
    if (isSecondaryActive) setToolsOpen(true);
  }, [isSecondaryActive]);

  const mainNavBtnCls = cn(
    'relative flex w-full items-center gap-2 rounded-chrome border text-left text-sm font-semibold transition-colors',
    touchFriendly ? 'min-h-11 py-3' : 'h-10',
    collapsed ? 'justify-center px-2' : 'px-4',
  );
  const secondaryBtnCls = cn(
    'flex w-full items-center gap-2 rounded-chrome text-left text-xs font-medium transition-colors',
    touchFriendly ? 'min-h-11 py-3' : 'h-9',
    collapsed ? 'justify-center px-2' : 'px-3',
  );

  return (
    <aside
      className={cn(
        'relative flex h-full w-full flex-col border-r border-border bg-sidebar-nav shadow-sidebar',
        className,
      )}
    >
      <div className={cn('flex justify-center pb-6 pt-10', collapsed ? 'px-2' : 'px-6')}>
        <LogoTecma className={cn('opacity-85', collapsed ? 'h-10 w-10' : 'h-24 w-24')} />
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto pb-5 pt-5', collapsed ? 'px-2' : 'px-6')}>
        {onCollapseToggle != null ? (
          <div className={cn('mb-8 flex justify-end', collapsed ? 'mb-4' : '')}>
            <button
              type="button"
              onClick={onCollapseToggle}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>
        ) : null}

        <nav className={cn('space-y-4', collapsed && 'space-y-2')}>
          {PRIMARY_NAV.map((item) => {
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
                    ? 'border-transparent bg-background text-primary shadow-sidebar-nav-active'
                    : 'border-transparent bg-white/15 text-muted-foreground shadow-sidebar-nav hover:bg-white/30',
                )}
              >
                {isActive && !collapsed ? (
                  <span className="absolute -left-3 top-0 h-full w-0.5 bg-primary" />
                ) : null}
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
                {collapsed ? <span className="sr-only">{item.label}</span> : null}
              </button>
            );
          })}

          {secondaryNav.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setToolsOpen((value) => !value)}
                title={collapsed ? 'Esplora e imposta' : undefined}
                className={cn(
                  mainNavBtnCls,
                  'border-0',
                  isSecondaryActive
                    ? 'bg-white/25 text-muted-foreground shadow-sidebar-nav'
                    : 'bg-white/15 text-muted-foreground shadow-sidebar-nav hover:bg-white/25',
                )}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                {!collapsed ? <span className="flex-1">Esplora e imposta</span> : null}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 flex-shrink-0 transition-transform',
                    toolsOpen && 'rotate-180',
                  )}
                />
                {collapsed ? <span className="sr-only">Esplora e imposta</span> : null}
              </button>

              {toolsOpen && collapsed ? (
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
                          'flex min-h-9 w-full items-center justify-center rounded-chrome transition-colors',
                          isActive
                            ? 'bg-background text-primary shadow-sidebar-nav-active'
                            : 'bg-white/15 text-muted-foreground hover:bg-white/30',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="sr-only">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {toolsOpen && !collapsed ? (
                <div className="space-y-4 pl-3">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Analisi
                    </p>
                    {INSIGHTS_NAV.map((item) => {
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
                              ? 'bg-background text-primary shadow-sidebar-nav-active'
                              : 'bg-white/15 text-muted-foreground shadow-sidebar-nav hover:bg-white/30',
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Impostazioni
                    </p>
                    {SETTINGS_NAV.filter((item) => item.id === 'workspaces' || isAdmin).map((item) => {
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
                              ? 'bg-background text-primary shadow-sidebar-nav-active'
                              : 'bg-white/15 text-muted-foreground shadow-sidebar-nav hover:bg-white/30',
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </nav>
      </div>

      <div className="p-6 pt-10">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Powered by</span>
          <img
            src={logotipoTecma}
            alt="TECMA"
            className="h-[11px] w-20 object-contain opacity-85"
          />
        </div>
      </div>
    </aside>
  );
};

export const PageTemplate = ({ accessToken, children }: PageTemplateProps) => {
  const [section, setSection] = useState<AppSection>(() => {
    if (typeof window === 'undefined') return 'cockpit';
    if (window.location.pathname === '/organization/workspaces') return 'workspaces';
    return 'cockpit';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const workspaceId =
    typeof window !== 'undefined'
      ? (window.sessionStorage.getItem('followup.workspaceId') ?? '')
      : '';
  const [workspaceState, setWorkspaceState] = useState(workspaceId);

  const userEmail =
    typeof window !== 'undefined'
      ? (window.sessionStorage.getItem('followup3.lastEmail') ?? '')
      : '';
  const isAdmin =
    typeof window !== 'undefined' && window.sessionStorage.getItem('followup3.isAdmin') === '1';

  const [projects, setProjects] = useState<ProjectAccessProject[]>(() => readProjectsFromSession());
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() =>
    readSelectedIds(readProjectsFromSession()),
  );

  const sidebarStorageKey = `followup.sidebarCollapsed${workspaceState ? `.${workspaceState}` : ''}`;
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(sidebarStorageKey) === 'true';
    } catch {
      return false;
    }
  });
  const setSidebarCollapsed = useCallback(
    (update: boolean | ((prev: boolean) => boolean)) => {
      setSidebarCollapsedState((prev) => {
        const next = typeof update === 'function' ? update(prev) : update;
        try {
          localStorage.setItem(sidebarStorageKey, String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [sidebarStorageKey],
  );

  const userName = userEmail.split('@')[0]?.replace(/[._-]/g, ' ') || 'Utente';

  useEffect(() => {
    setProjects(readProjectsFromSession());
    setSelectedProjectIds(readSelectedIds(readProjectsFromSession()));
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current != null && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (userMenuRef.current != null && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const persistSelection = (ids: string[]) => {
    setSelectedProjectIds(ids);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('followup.projectScope', JSON.stringify(ids));
    }
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const refreshToken = window.sessionStorage.getItem('followup.auth.refreshToken');
    const clear = () => {
      window.sessionStorage.removeItem('followup.auth.accessToken');
      window.sessionStorage.removeItem('followup.auth.refreshToken');
      window.sessionStorage.removeItem('followup3.accessToken');
      window.sessionStorage.removeItem('followup3.lastEmail');
      window.sessionStorage.removeItem('followup3.isAdmin');
      window.sessionStorage.removeItem('followup.projectScope');
      window.sessionStorage.removeItem('followup3.projectsCache');
      window.location.reload();
    };
    if (refreshToken != null && refreshToken.length > 0) {
      void http('/auth/logout', { method: 'POST', accessToken, body: { refreshToken } })
        .catch(() => undefined)
        .finally(clear);
    } else {
      clear();
    }
  };

  const deployEnvironment = String(import.meta.env.VITE_APP_ENV ?? '').toLowerCase();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;
    if (section === 'workspaces' && pathname !== '/organization/workspaces') {
      window.history.pushState({}, '', '/organization/workspaces');
      return;
    }
    if (section !== 'workspaces' && pathname === '/organization/workspaces') {
      window.history.pushState({}, '', '/');
    }
  }, [section]);

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-app font-body text-foreground"
      data-testid="tecma-templatePage"
    >
      <div
        className={cn(
          'hidden flex-shrink-0 transition-[width] lg:block',
          sidebarCollapsed ? 'w-16' : 'w-64',
        )}
      >
        <SideNav
          section={section}
          onSectionChange={setSection}
          isAdmin={isAdmin}
          collapsed={sidebarCollapsed}
          onCollapseToggle={() => setSidebarCollapsed((v) => !v)}
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
            onSectionChange={(s) => {
              setSection(s);
              setMobileNavOpen(false);
            }}
            isAdmin={isAdmin}
            touchFriendly
            className="h-full"
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-[72px] items-center justify-end border-b border-border bg-background px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <WorkspaceSelector
              workspaceId={workspaceState}
              onChangeWorkspace={(id) => {
                setWorkspaceState(id);
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem('followup.workspaceId', id);
                }
              }}
              accessToken={accessToken}
            />

            {projects.length > 0 ? (
              <ProjectSelector
                workspaceId={workspaceState}
                projects={projects}
                selectedProjectIds={selectedProjectIds}
                onSelectedProjectIdsChange={persistSelection}
              />
            ) : null}

            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-chrome border border-border bg-background px-3 text-sm text-foreground hover:bg-muted"
              >
                <Settings className="h-3.5 w-3.5" />
                Impostazioni
              </button>
              {settingsOpen ? (
                <div className="absolute right-0 top-12 w-48 overflow-hidden rounded-ui border border-border bg-card shadow-dropdown">
                  {[
                    {
                      label: 'Workspace management',
                      icon: FolderKanban,
                      id: 'workspaces' as AppSection,
                    },
                    { label: 'Progetti', icon: Building2, id: 'projects' as AppSection },
                    { label: 'Integrazioni', icon: Plug, id: 'integrations' as AppSection },
                    {
                      label: 'Sicurezza account',
                      icon: Shield,
                      id: 'accountSecurity' as AppSection,
                    },
                  ]
                    .filter((entry) => entry.id === 'workspaces' || isAdmin)
                    .map((entry) => {
                      const Icon = entry.icon;
                      return (
                        <button
                          key={entry.label}
                          type="button"
                          onClick={() => {
                            setSettingsOpen(false);
                            setSection(entry.id);
                          }}
                          className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {entry.label}
                        </button>
                      );
                    })}
                  {isAdmin ? (
                    <a
                      href="/organization/setup"
                      className="flex min-h-11 w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs font-medium text-primary hover:bg-muted"
                      onClick={() => setSettingsOpen(false)}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Guida workspace (wizard)
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                title={userEmail}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-chrome border px-2 text-sm transition-colors',
                  userMenuOpen
                    ? 'border-primary bg-sidebar-accent text-primary'
                    : 'border-transparent bg-transparent text-foreground hover:bg-muted',
                )}
              >
                <UserCircle className="h-4 w-4" />
                <span className="max-w-[120px] truncate">{userName}</span>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', userMenuOpen && 'rotate-180')}
                />
              </button>
              {userMenuOpen ? (
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
                        window.sessionStorage.removeItem('followup.auth.accessToken');
                        window.location.reload();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <Layers className="h-4 w-4" />
                      Cambia progetti
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSection('accountSecurity');
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <Shield className="h-4 w-4" />
                      Sicurezza (MFA)
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" />
                      Esci
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {(deployEnvironment === 'dev-1' || deployEnvironment === 'dev1') && (
          <div className="relative z-10 w-full bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
            Ambiente di sviluppo – non produzione
          </div>
        )}
        {deployEnvironment === 'demo' && (
          <div className="relative z-10 w-full bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-amber-950">
            Ambiente Demo – non produzione
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-auto pb-16 lg:pb-0">
          {section === 'workspaces' ? (
            <WorkspaceManagementPage
              accessToken={accessToken}
              isTecmaAdmin={isAdmin}
              onOpenSetupWizard={() => {
                setSettingsOpen(false);
                window.location.assign('/organization/setup');
              }}
            />
          ) : (
            children
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {mobileQuickNav.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    'inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-chrome px-2 text-[11px] font-medium',
                    active
                      ? 'bg-sidebar-accent text-primary'
                      : 'text-muted-foreground hover:bg-muted',
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
          <button type="button" className="hover:text-foreground hover:underline">
            Come funziona
          </button>
          {isAdmin ? (
            <button type="button" className="hover:text-foreground hover:underline">
              Audit log
            </button>
          ) : null}
          <button type="button" className="hover:text-foreground hover:underline">
            Novità di prodotto
          </button>
        </footer>
      </div>
    </div>
  );
};
