/** Valori status per filtro API (backend usa $in su status) */
export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tutti gli stati" },
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Cliente" },
  { value: "contacted", label: "Contattato" },
  { value: "negotiation", label: "In trattativa" },
  { value: "won", label: "Vinto" },
  { value: "lost", label: "Perso" },
];

/** Tipologia tabella lista clienti (come in fe-tecma-followup) */
export type ClientTableType = "contacts" | "myHome" | "crm" | "otherInfo";

export const TABLE_TYPE_OPTIONS: { value: ClientTableType; label: string }[] = [
  { value: "contacts", label: "Contatti" },
  { value: "myHome", label: "MyHome" },
  { value: "crm", label: "CRM" },
  { value: "otherInfo", label: "Altre informazioni" },
];
