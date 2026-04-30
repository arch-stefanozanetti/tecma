/**
 * TypeScript interfaces for MongoDB collections (Access Control & Multi-Tenant spec).
 * Used by canAccess, services, and migrations. Do not duplicate field definitions.
 */
import type { ObjectId } from "mongodb";

/** tz_users: identity globale. system_role solo per TECMA. */
export interface TzUserDoc {
  _id: ObjectId;
  email: string;
  password_hash?: string;
  /** Legacy: some code still uses "password" */
  password?: string;
  system_role?: "tecma_admin" | null;
  role?: string;
  project_ids?: string[];
  permissions_override?: string[];
  status?: string;
  isDisabled?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

/** tz_workspaces: contenitore dati. owner_user_id = creatore/proprietario. */
export interface TzWorkspaceDoc {
  _id: ObjectId;
  name: string;
  owner_user_id?: ObjectId | string | null;
  slug?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Ruoli membership fissi (non configurabili in UI). */
export type MembershipRole = "owner" | "admin" | "collaborator" | "viewer";

/** access_scope: in UI è un toggle "Tutto" / "Solo assegnati". */
export type AccessScope = "all" | "assigned";

/** tz_user_workspaces: membership utente in workspace. */
export interface TzMembershipDoc {
  _id: ObjectId;
  user_id: string;
  /** Fase 1: può essere email (string). Fase 2: ObjectId hex da tz_users. */
  userId?: string;
  workspace_id: string;
  workspaceId?: string;
  role: MembershipRole;
  access_scope: AccessScope;
  created_at?: Date | string;
  updated_at?: Date | string;
  createdAt?: string;
  updatedAt?: string;
}

/** tz_projects: workspace_id = workspace owner del progetto. */
export interface TzProjectDoc {
  _id: ObjectId | string;
  name?: string;
  displayName?: string;
  workspace_id?: string;
  mode?: "rent" | "sell";
  archived?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

/** Ruolo in project_access (collaborazione tra workspace). */
export type ProjectAccessRole = "owner" | "collaborator" | "viewer";

/** tz_project_access: quale workspace ha accesso a quale progetto (non owner). */
export interface TzProjectAccessDoc {
  _id: ObjectId;
  project_id: string;
  workspace_id: string;
  role: ProjectAccessRole;
  created_at: Date | string;
}

/** tz_clients: scoped per workspace. Unicità (workspace_id, email). */
export interface TzClientDoc {
  _id: ObjectId;
  workspace_id: string;
  workspaceId?: string;
  project_id?: string;
  projectId?: string;
  email?: string;
  name?: string;
  fullName?: string;
  created_at?: Date;
  updated_at?: Date;
  createdAt?: string;
  updatedAt?: string;
}

/** tz_audit_log: schema unificato audit. */
export interface TzAuditLogDoc {
  _id: ObjectId;
  user_id: string;
  userId?: string;
  action: string;
  entity_type: string;
  entityType?: string;
  entity_id: string;
  entityId?: string;
  workspace_id: string;
  workspaceId?: string;
  created_at: Date;
  createdAt?: Date;
  at?: Date;
  metadata?: Record<string, unknown>;
}

/** Asset type: immagini progetto, planimetrie, branding. */
export type AssetType = "image" | "document" | "planimetry" | "branding";

/** tz_assets: asset generici (immagini progetto, planimetrie, branding). */
export interface TzAssetDoc {
  _id: ObjectId;
  workspace_id: string;
  project_id?: string;
  apartment_id?: string;
  type: AssetType;
  name: string;
  file_key: string;
  file_url?: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: Date;
}

/** tz_client_documents: documenti sensibili cliente (proposta, contratto). */
export type ClientDocumentType = "proposta" | "contratto" | "altro";
export type ClientDocumentVisibility = "internal" | "client";

export interface TzClientDocumentDoc {
  _id: ObjectId;
  workspace_id: string;
  client_id: string;
  project_id?: string;
  name: string;
  file_key: string;
  file_size: number;
  type: ClientDocumentType;
  visibility: ClientDocumentVisibility;
  uploaded_by: string;
  created_at: Date;
}
