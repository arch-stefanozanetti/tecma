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
  | "productDiscovery";

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
};

export const PATH_TO_SECTION: Record<string, Section> = Object.fromEntries(
  (Object.entries(SECTION_TO_PATH) as [Section, string][]).map(([s, p]) => [p, s])
);

export interface NavItemConfig {
  id: Section;
  label: string;
  icon: LucideIcon;
  compact?: boolean;
  adminOnly?: boolean;
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
  { id: "reports", label: "Report", icon: BarChart2, compact: true, group: "tools" },
];
