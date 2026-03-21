/**
 * Mappatura vocabolario enterprise (ISO/SOC2) ↔ ruoli tecnici FollowUp (workspace + sistema + portale).
 * I ruoli workspace restano owner | admin | collaborator | viewer (tz_roleDefinitions).
 */

export type EnterpriseRoleKey =
  | "super_admin"
  | "admin"
  | "manager"
  | "agent"
  | "external_client";

export interface EnterpriseRoleMappingRow {
  enterpriseRole: EnterpriseRoleKey;
  description: string;
  /** Ruolo/i workspace equivalenti (ordine di priorità). */
  workspaceRoles: Array<"owner" | "admin" | "collaborator" | "viewer">;
  /** Tecma operatori piattaforma. */
  matchesTecmaAdmin: boolean;
  /** Accesso customer portal (magic link), non JWT staff. */
  matchesCustomerPortal: boolean;
}

export const ENTERPRISE_ROLE_MAP: EnterpriseRoleMappingRow[] = [
  {
    enterpriseRole: "super_admin",
    description: "Amministrazione piattaforma Tecma (tutti i workspace, bypass controlli progetto).",
    workspaceRoles: [],
    matchesTecmaAdmin: true,
    matchesCustomerPortal: false
  },
  {
    enterpriseRole: "admin",
    description: "Amministratore del workspace (stesso piano permessi di owner per membership).",
    workspaceRoles: ["owner", "admin"],
    matchesTecmaAdmin: false,
    matchesCustomerPortal: false
  },
  {
    enterpriseRole: "manager",
    description: "Responsabile operativo CRM (permessi ampi, tipicamente admin workspace o owner).",
    workspaceRoles: ["owner", "admin"],
    matchesTecmaAdmin: false,
    matchesCustomerPortal: false
  },
  {
    enterpriseRole: "agent",
    description: "Operatore commerciale (collaborator / viewer secondo policy).",
    workspaceRoles: ["collaborator", "viewer"],
    matchesTecmaAdmin: false,
    matchesCustomerPortal: false
  },
  {
    enterpriseRole: "external_client",
    description: "Cliente finale — solo portale dedicato (sessioni tz_portal_sessions), non API staff.",
    workspaceRoles: [],
    matchesTecmaAdmin: false,
    matchesCustomerPortal: true
  }
];

export function listEnterpriseRoleMappings(): EnterpriseRoleMappingRow[] {
  return [...ENTERPRISE_ROLE_MAP];
}
