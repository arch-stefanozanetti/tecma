const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  Lead: "Lead",
  LEAD: "Lead",
  prospect: "Prospect",
  Prospect: "Prospect",
  PROSPECT: "Prospect",
  client: "Client",
  Client: "Client",
  CLIENT: "Client",
  contacted: "Contacted",
  CONTACTED: "Contacted",
  negotiation: "Negotiation",
  NEGOTIATION: "Negotiation",
  won: "Won",
  WON: "Won",
  lost: "Lost",
  LOST: "Lost",
};

export const statusLabel = (raw: string) => STATUS_LABEL[raw] ?? raw;

export const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};
