import type {
  RequestStatus,
  RequestType,
  ClientRole,
  RequestActionType,
} from "../../types/domain";
import { formatDate } from "../../lib/formatDate";

export const TYPE_LABEL: Record<RequestType, string> = {
  rent: "Affitto",
  sell: "Vendita",
};

export const EMPTY_STATUS_LABEL: Record<string, string> = {};

export const CLIENT_ROLE_LABEL: Record<ClientRole, string> = {
  buyer: "Acquirente",
  seller: "Venditore",
  tenant: "Affittuario",
  landlord: "Cedente",
};

export const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tutti i tipi" },
  { value: "rent", label: "Affitto" },
  { value: "sell", label: "Vendita" },
];

export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tutti gli stati" },
];

export const ACTION_TYPE_LABEL: Record<RequestActionType, string> = {
  note: "Nota",
  call: "Chiamata",
  email: "Email",
  meeting: "Incontro",
  other: "Altro",
};

export { formatDate };
export type { RequestStatus };
export type ViewMode = "table" | "card" | "kanban";
export const REQUESTS_PER_PAGE = 25;
