import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  Database,
  Building2,
  CalendarDays,
  Euro,
  FolderKanban,
  GitBranch,
  Handshake,
  Home,
  Inbox as InboxIcon,
  Kanban,
  Layers,
  Mail,
  Plug,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react";

/** Unica fonte di verità per le sezioni dell'app (route + navigation). */
export type Section =
  | "cockpit"
  | "howItWorks"
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
  | "rentRevenue"
  | "bigData"
  | "releases"
  | "integrations"
  | "priceAvailability"
  | "inbox"
  | "customer360"
  | "productDiscovery"
  | "experimental"
  | "tecmaEntitlements"
  | "productBlueprint"
  | "accountSecurity"
  | "executiveOverview"
  | "coima"
  | "zeus";

export const SECTIONS: Section[] = [
  "cockpit",
  "howItWorks",
  "calendar",
  "clients",
  "apartments",
  "requests",
  "projects",
  "inbox",
  "customer360",
  "createApartment",
  "createApartmentHC",
  "editApartmentHC",
  "associateAptClient",
  "completeFlow",
  "catalogHC",
  "templateConfig",
  "aiApprovals",
  "workflowConfig",
  "workspaces",
  "users",
  "emailFlows",
  "audit",
  "reports",
  "rentRevenue",
  "bigData",
  "releases",
  "integrations",
  "priceAvailability",
  "productDiscovery",
  "experimental",
  "tecmaEntitlements",
  "productBlueprint",
  "accountSecurity",
  "executiveOverview",
  "coima",
  "zeus",
];

/** Path puliti per le sezioni; le altre usano ?section=X */
export const SECTION_TO_PATH: Partial<Record<Section, string>> = {
  cockpit: "/",
  howItWorks: "/come-funziona",
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
  rentRevenue: "/rent-revenue",
  bigData: "/big-data",
  releases: "/releases",
  integrations: "/integrations",
  priceAvailability: "/prices",
  productDiscovery: "/product-discovery",
  experimental: "/experimental",
  tecmaEntitlements: "/tecma/entitlements",
  productBlueprint: "/tecma/product-blueprint",
  accountSecurity: "/account/security",
  executiveOverview: "/executive",
  coima: "/coima",
  zeus: "/zeus",
};

export const PATH_TO_SECTION: Record<string, Section> = Object.fromEntries(
  (Object.entries(SECTION_TO_PATH) as [Section, string][]).map(([s, p]) => [p, s])
);

/** Un permesso o tutti quelli elencati (AND) per la sezione. */
export type SectionPermissionSpec = string | readonly string[];

/**
 * Permessi JWT per nav, command palette e accesso diretto (path / ?section=).
 * Sezione assente = nessun gate permesso (solo feature flag / admin dove già previsto).
 */
export const SECTION_REQUIRED_PERMISSION: Partial<Record<Section, SectionPermissionSpec>> = {
  users: "users.read",
  workspaces: "settings.read",
  projects: "settings.read",
  workflowConfig: "settings.read",
  calendar: "calendar.read",
  clients: "clients.read",
  apartments: "apartments.read",
  requests: "requests.read",
  inbox: "requests.read",
  customer360: ["clients.read", "requests.read"],
  priceAvailability: "apartments.read",
  integrations: "integrations.read",
  zeus: "integrations.read",
  reports: "reports.read",
  rentRevenue: "reports.read",
  bigData: "reports.read",
  audit: "settings.read",
  tecmaEntitlements: "settings.read",
  productBlueprint: "settings.read",
  emailFlows: "email_flows.manage",
  aiApprovals: "requests.read",
  createApartment: "apartments.create",
  createApartmentHC: "apartments.create",
  editApartmentHC: "apartments.update",
  associateAptClient: ["clients.read", "apartments.read"],
  completeFlow: "requests.read",
  catalogHC: "apartments.read",
  templateConfig: "apartments.read",
};

/** True se l’utente soddisfa i permessi richiesti per la sezione (admin / `*` gestiti dal callback). */
export function sectionMeetsPermissionRequirements(
  section: Section,
  hasPermission?: (perm: string) => boolean
): boolean {
  if (!hasPermission) return true;
  const spec = SECTION_REQUIRED_PERMISSION[section];
  if (spec === undefined) return true;
  const list = typeof spec === "string" ? [spec] : [...spec];
  return list.every((p) => hasPermission(p));
}

/** Testo per messaggi “accesso negato” (debug / supporto). */
export function sectionRequiredPermissionHint(section: Section): string {
  const spec = SECTION_REQUIRED_PERMISSION[section];
  if (spec === undefined) return "";
  return typeof spec === "string" ? spec : spec.join(" + ");
}

export interface NavItemConfig {
  id: Section;
  label: string;
  icon: LucideIcon;
  navGroup: "primary" | "insights" | "settings" | "internal";
  adminOnly?: boolean;
  /** Solo utenti con JWT `isTecmaAdmin` (system_role tecma_admin). */
  tecmaAdminOnly?: boolean;
}

/** Voci di navigazione (sidebar): stesse section/path usate in App per routing. */
export const NAV_ITEMS: NavItemConfig[] = [
  { id: "cockpit", label: "Home", icon: Home, navGroup: "primary" },
  { id: "clients", label: "Clienti", icon: Users, navGroup: "primary" },
  { id: "apartments", label: "Appartamenti", icon: Building2, navGroup: "primary" },
  { id: "requests", label: "Trattative", icon: Handshake, navGroup: "primary" },
  { id: "calendar", label: "Calendario", icon: CalendarDays, navGroup: "primary" },
  { id: "inbox", label: "Inbox", icon: InboxIcon, navGroup: "primary" },
  { id: "customer360", label: "Customer 360", icon: UserCircle, navGroup: "insights" },
  { id: "reports", label: "Report", icon: BarChart2, navGroup: "insights" },
  { id: "rentRevenue", label: "Ricavi affitti", icon: TrendingUp, navGroup: "insights" },
  { id: "priceAvailability", label: "Prezzi e disponibilità", icon: Euro, navGroup: "insights" },
  { id: "projects", label: "Progetti", icon: Building2, navGroup: "settings" },
  { id: "integrations", label: "Integrazioni", icon: Plug, navGroup: "settings" },
  { id: "accountSecurity", label: "Sicurezza account", icon: ShieldCheck, navGroup: "settings" },
  { id: "workflowConfig", label: "Workflow", icon: GitBranch, navGroup: "settings", adminOnly: true },
  { id: "workspaces", label: "Workspace", icon: FolderKanban, navGroup: "settings", adminOnly: true },
  { id: "users", label: "Utenti", icon: UserCircle, navGroup: "settings", adminOnly: true },
  { id: "emailFlows", label: "Email transazionali", icon: Mail, navGroup: "settings", adminOnly: true },
  { id: "zeus", label: "Agente ZEUS", icon: Sparkles, navGroup: "internal" },
  { id: "bigData", label: "Analisi marketing", icon: Database, navGroup: "internal" },
  { id: "productDiscovery", label: "Product Discovery", icon: Layers, navGroup: "internal", adminOnly: true },
  {
    id: "executiveOverview",
    label: "Panoramica strategica",
    icon: BookOpen,
    navGroup: "internal",
    adminOnly: true,
  },
  {
    id: "coima",
    label: "Assessment COIMA / BTS",
    icon: ClipboardList,
    navGroup: "internal",
    adminOnly: true,
  },
  {
    id: "tecmaEntitlements",
    label: "Entitlement workspace",
    icon: ShieldCheck,
    navGroup: "internal",
    tecmaAdminOnly: true,
  },
  {
    id: "productBlueprint",
    label: "Product Blueprint (Jira)",
    icon: Kanban,
    navGroup: "internal",
    tecmaAdminOnly: true,
  },
  {
    id: "experimental",
    label: "Experimental",
    icon: Layers,
    navGroup: "internal",
    tecmaAdminOnly: true,
  },
];
