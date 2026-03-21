import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  Building2,
  CalendarDays,
  Euro,
  FolderKanban,
  GitBranch,
  Handshake,
  Home,
  Inbox as InboxIcon,
  Layers,
  Mail,
  Plug,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";

/** Unica fonte di verità per le sezioni dell'app (route + navigation). */
export type Section =
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
  | "productDiscovery"
  | "tecmaEntitlements";

export const SECTIONS: Section[] = [
  "cockpit",
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
  "releases",
  "integrations",
  "priceAvailability",
  "productDiscovery",
  "tecmaEntitlements",
];

/** Path puliti per le sezioni; le altre usano ?section=X */
export const SECTION_TO_PATH: Partial<Record<Section, string>> = {
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
  tecmaEntitlements: "/tecma/entitlements",
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
  calendar: "calendar.read",
  clients: "clients.read",
  apartments: "apartments.read",
  requests: "requests.read",
  inbox: "requests.read",
  customer360: ["clients.read", "requests.read"],
  priceAvailability: "apartments.read",
  integrations: "integrations.read",
  reports: "reports.read",
  audit: "settings.read",
  tecmaEntitlements: "settings.read",
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
  compact?: boolean;
  adminOnly?: boolean;
  /** Solo utenti con JWT `isTecmaAdmin` (system_role tecma_admin). */
  tecmaAdminOnly?: boolean;
  group?: "tools" | "admin";
}

/** Voci di navigazione (sidebar): stesse section/path usate in App per routing. */
export const NAV_ITEMS: NavItemConfig[] = [
  { id: "cockpit", label: "Home", icon: Home },
  { id: "apartments", label: "Appartamenti", icon: Building2 },
  { id: "clients", label: "Clienti", icon: Users },
  { id: "requests", label: "Trattative", icon: Handshake },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "customer360", label: "Customer 360", icon: UserCircle },
  { id: "projects", label: "Progetti", icon: Building2 },
  { id: "priceAvailability", label: "Prezzi e disponibilità", icon: Euro, compact: true, group: "tools" },
  { id: "integrations", label: "Integrazioni e automazioni", icon: Plug, compact: true, group: "tools" },
  { id: "workflowConfig", label: "Config. workflow", icon: GitBranch, adminOnly: true, compact: true, group: "admin" },
  { id: "workspaces", label: "Workspaces", icon: FolderKanban, adminOnly: true, compact: true, group: "admin" },
  { id: "users", label: "User", icon: UserCircle, adminOnly: true, compact: true, group: "admin" },
  { id: "emailFlows", label: "Email", icon: Mail, adminOnly: true, compact: true, group: "admin" },
  { id: "productDiscovery", label: "Product Discovery", icon: Layers, adminOnly: true, compact: true, group: "admin" },
  {
    id: "tecmaEntitlements",
    label: "Entitlement workspace",
    icon: ShieldCheck,
    tecmaAdminOnly: true,
    compact: true,
    group: "admin",
  },
  { id: "reports", label: "Report", icon: BarChart2, compact: true, group: "tools" },
];
