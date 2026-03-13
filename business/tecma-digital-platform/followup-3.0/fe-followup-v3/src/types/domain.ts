export interface ListQuery {
  workspaceId: string;
  projectIds: string[];
  page: number;
  perPage: number;
  searchText?: string;
  sort?: { field: string; direction: 1 | -1 };
  filters?: Record<string, unknown>;
}

export interface Pagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface WorkspaceRow {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Chiavi feature abilitate per questo workspace. Se assente = tutte abilitate. */
  features?: string[];
}

export interface WorkspaceProjectRow {
  workspaceId: string;
  projectId: string;
  createdAt: string;
}

export type WorkspaceUserRole = "vendor" | "vendor_manager" | "admin";

export interface WorkspaceUserRow {
  _id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceUserRole;
  createdAt: string;
  updatedAt: string;
}

export type AdditionalInfoType = "text" | "radio" | "slider" | "number" | "checkbox";

export interface AdditionalInfoRow {
  _id: string;
  workspaceId: string;
  name: string;
  type: AdditionalInfoType;
  label: string;
  path?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  position?: number;
  subSection?: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdditionalInfoCreateInput {
  workspaceId: string;
  name: string;
  type: AdditionalInfoType;
  label: string;
  path?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  position?: number;
  subSection?: string;
  active?: boolean;
}

export interface CalendarEvent {
  _id: string;
  workspaceId?: string;
  projectId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: "FOLLOWUP_SELL" | "FOLLOWUP_RENT" | "CUSTOM_SERVICE";
}

export interface ClientConiuge {
  nome?: string;
  cognome?: string;
  mail?: string;
  indirizzo?: string;
  tel?: string;
}

export interface ClientFamily {
  adulti?: number | null;
  bambini?: number | null;
  animali?: number | null;
}

export interface ClientSelectedApartment {
  appartment?: string;
  status?: string;
  _id?: string;
  createdOn?: string;
}

export interface ClientAction {
  actionName?: string;
  actionDate?: string;
  vendor?: string;
  note?: string | null;
  quote?: string | null;
  category?: string;
  deleted?: boolean;
  _id?: string;
  createdOn?: string;
  eventId?: string;
}

export interface ClientRow {
  _id: string;
  workspaceId?: string;
  projectId: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  createdAt?: string;
  updatedAt: string;
  source?: string;
  city?: string;
  myhomeVersion?: string;
  createdBy?: string;
  /** Dati enterprise (opzionali). */
  coniuge?: ClientConiuge;
  family?: ClientFamily;
  budget?: number | string | null;
  motivazione?: string;
  note?: string;
  profilazione?: boolean;
  trattamento?: boolean;
  marketing?: boolean;
  selectedAppartments?: ClientSelectedApartment[];
  interestedAppartments?: ClientSelectedApartment[];
  actions?: ClientAction[];
  activityState?: string;
  activityStateHistory?: Array<{ date?: string; activityState?: string; reason?: string; movement?: string | null }>;
  additionalInfo?: Record<string, unknown>;
  nProposals?: number;
  nReserved?: number;
}

export interface ClientCreateInput {
  workspaceId: string;
  projectId: string;
  fullName: string;
  email?: string;
  phone?: string;
  status?: string;
  city?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface ClientUpdateInput {
  fullName?: string;
  email?: string;
  phone?: string;
  status?: string;
  city?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface CalendarEventCreateInput {
  workspaceId: string;
  projectId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source?: CalendarEvent["source"];
}

export interface CalendarEventUpdateInput {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  projectId?: string;
  source?: CalendarEvent["source"];
}

export interface ApartmentPlan {
  _id?: string;
  name?: string;
  typology?: { _id?: string; name?: string };
  model?: { _id?: string; name?: string };
  dimension?: { _id?: string; name?: string };
  surfaceArea?: {
    total?: number;
    commercial?: number;
    apartment?: number;
    balcony?: number;
    garden?: number;
    loggia?: number;
    terrace?: number;
    penthouse?: number;
  };
  mainFeatures?: { rooms?: number; bathroom?: number; bedroom?: number; openPlanKitchen?: boolean };
}

export interface ApartmentBuilding {
  _id?: string;
  name?: string;
  address?: string | null;
  floors?: number;
  code?: string;
  zone?: string | null;
  complex?: string;
  geo?: { lat?: number; lon?: number };
}

export interface ApartmentSide {
  _id?: string;
  name?: string;
}

export interface ApartmentRow {
  _id: string;
  projectId: string;
  code: string;
  name: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
  mode: "RENT" | "SELL";
  surfaceMq: number;
  normalizedPrice?: {
    display: string;
  };
  rawPrice?: { mode: "RENT" | "SELL"; amount: number };
  updatedAt: string;
  /** Dati enterprise (opzionali). */
  plan?: ApartmentPlan;
  building?: ApartmentBuilding;
  sides?: ApartmentSide[];
  floor?: number;
  extraInfo?: Record<string, unknown>;
}

/** Richiesta/trattativa unificata rent + sell (Wave 4). */
export type RequestType = "rent" | "sell";
export type RequestStatus =
  | "new"
  | "contacted"
  | "viewing"
  | "quote"
  | "offer"
  | "won"
  | "lost";

/** Ruolo cliente rispetto all'immobile (compravendita). */
export type ClientRole = "buyer" | "seller" | "tenant" | "landlord";

export interface RequestRow {
  _id: string;
  projectId: string;
  workspaceId: string;
  clientId: string;
  apartmentId?: string;
  type: RequestType;
  status: RequestStatus;
  /** Ruolo: acquirente, venditore, affittuario, cedente. */
  clientRole?: ClientRole;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  apartmentCode?: string;
  /** Riferimento a tz_quotes (quote). */
  quoteId?: string;
  quoteStatus?: string;
  quoteNumber?: string;
  quoteExpiryOn?: string;
  quoteTotalPrice?: number;
}

/** Transizione di stato di una trattativa (timeline). */
export interface RequestTransitionRow {
  _id: string;
  requestId: string;
  fromState: RequestStatus;
  toState: RequestStatus;
  event: string;
  reason?: string;
  userId?: string;
  createdAt: string;
}

/** Tipo azione in timeline trattative. */
export type RequestActionType = "note" | "call" | "email" | "meeting" | "other";

/** Azione associata a una o più trattative. */
export interface RequestActionRow {
  _id: string;
  workspaceId: string;
  requestIds: string[];
  type: RequestActionType;
  title?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface RequestCreateInput {
  workspaceId: string;
  projectId: string;
  clientId: string;
  apartmentId?: string;
  type: RequestType;
  status?: RequestStatus;
  clientRole?: ClientRole;
  quoteId?: string;
}

export interface ProjectAccessProject {
  id: string;
  name: string;
  displayName: string;
}

export interface ProjectAccessResponse {
  found: boolean;
  email: string;
  role: string | null;
  isAdmin: boolean;
  projects: ProjectAccessProject[];
}

export interface UserPreferences {
  found: boolean;
  email?: string;
  workspaceId?: string;
  selectedProjectIds?: string[];
  updatedAt?: string;
}

export interface ApartmentCreateInput {
  workspaceId: string;
  projectId: string;
  name: string;
  code: string;
  price: number;
  floor: number;
  mode: "RENT" | "SELL";
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
  surfaceMq: number;
  planimetryUrl: string;
}

export interface HCApartmentConfig {
  workspaceId: string;
  projectId: string;
  apartmentId: string;
  selectedSectionCodes: string[];
  selectedSectionIds: string[];
  formValues: Record<string, number>;
  finishesPrices: Array<{ id: string; price: number; code?: string }>;
  legacyIncomplete?: boolean;
}

export interface AssociationCreateInput {
  workspaceId: string;
  projectId: string;
  apartmentId: string;
  clientId: string;
  status: "proposta" | "compromesso" | "rogito";
  forceDowngrade?: boolean;
}

export interface CompleteFlowPayload {
  workspaceId: string;
  projectId: string;
  apartment: Omit<ApartmentCreateInput, "workspaceId" | "projectId">;
  hc: Omit<HCApartmentConfig, "workspaceId" | "projectId" | "apartmentId"> & { apartmentId?: string };
  association: Omit<AssociationCreateInput, "workspaceId" | "projectId" | "apartmentId"> & { apartmentId?: string };
}

export type HCMasterEntity = "section" | "mood" | "finish" | "specification" | "optional";

export interface HCMasterEntityRecord {
  _id?: string;
  workspaceId: string;
  projectId: string;
  code: string;
  name: string;
  description?: string;
  relatedIds?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConfigurationTemplateSchema {
  sections: Array<{
    id: string;
    title: string;
    fields: Array<{
      key: string;
      label: string;
      type: "number" | "text" | "select" | "multiselect";
      required?: boolean;
    }>;
  }>;
}

export interface AiSuggestion {
  _id: string;
  workspaceId: string;
  projectIds: string[];
  title: string;
  reason: string;
  recommendedAction: string;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  status: "pending" | "approved" | "rejected";
  score: number;
  createdAt: string;
}

export interface AiActionDraft {
  _id: string;
  workspaceId: string;
  projectId: string;
  suggestionId: string;
  actionType: "create_task" | "send_reminder";
  title: string;
  message: string;
  target?: {
    clientId?: string;
    apartmentId?: string;
  };
  dueAt?: string | null;
  status: "pending_approval" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
}
