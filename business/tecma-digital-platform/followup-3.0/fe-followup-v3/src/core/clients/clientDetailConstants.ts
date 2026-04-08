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

/** Azioni rapide profilo cliente → scritte in audit (`client.*`) e mostrate in timeline. */
export const CLIENT_QUICK_AUDIT_ACTIONS = [
  "client.mail_received",
  "client.mail_sent",
  "client.call_completed",
  "client.meeting_scheduled",
] as const;

export const CLIENT_QUICK_ACTION_LABEL: Record<(typeof CLIENT_QUICK_AUDIT_ACTIONS)[number], string> = {
  "client.mail_received": "Mail ricevuta",
  "client.mail_sent": "Mail inviata",
  "client.call_completed": "Chiamata fatta",
  "client.meeting_scheduled": "Meeting fissato",
};

export function clientQuickActionLabel(action: string): string {
  return CLIENT_QUICK_ACTION_LABEL[action as keyof typeof CLIENT_QUICK_ACTION_LABEL] ?? action;
}

export function isClientQuickAuditAction(action: string): boolean {
  return (CLIENT_QUICK_AUDIT_ACTIONS as readonly string[]).includes(action);
}

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
