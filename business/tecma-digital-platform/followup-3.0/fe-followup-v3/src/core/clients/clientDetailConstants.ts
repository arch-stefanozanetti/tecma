import type { ClientRow, RequestActionType } from "../../types/domain";

export const ACTION_TYPE_LABEL: Record<RequestActionType, string> = {
  note: "Nota",
  call: "Chiamata",
  email: "Email",
  meeting: "Incontro",
  other: "Altro",
};

export const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  Lead: "Lead",
  prospect: "Prospect",
  Prospect: "Prospect",
  client: "Client",
  Client: "Client",
  contacted: "Contacted",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const statusLabel = (raw: string): string => STATUS_LABEL[raw] ?? raw;

/** Campi usati per la profilazione (match): più sono compilati, migliore il match. */
export const PROFILATION_FIELDS: (keyof ClientRow)[] = [
  "email",
  "phone",
  "city",
  "source",
  "myhomeVersion",
  "createdBy",
];

export function getProfilationPercent(client: ClientRow): number {
  let filled = 0;
  for (const key of PROFILATION_FIELDS) {
    const v = client[key];
    if (v != null && String(v).trim() !== "") filled++;
  }
  const total = PROFILATION_FIELDS.length;
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}
