/** Allineato a be-followup-v3 calendar-domain (legacy CRM). `source` = canale business; activityType = tipo operativo. */

export const CALENDAR_ACTIVITY_TYPES = [
  "call",
  "videoCall",
  "meeting",
  "onsiteInspection",
  "proposal",
  "customActivity",
  "busy",
  "outOfOffice",
] as const;
export type CalendarActivityType = (typeof CALENDAR_ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<CalendarActivityType, string> = {
  call: "Chiamata",
  videoCall: "Videochiamata",
  meeting: "Appuntamento (Store)",
  onsiteInspection: "Sopralluogo",
  proposal: "Proposta d'acquisto",
  customActivity: "Attività personalizzata",
  busy: "Occupato",
  outOfOffice: "Fuori ufficio",
};

export const CALENDAR_ACTIVITY_STATUSES = ["none", "confirmed", "pending", "lowReliability", "canceled"] as const;
export type CalendarActivityStatus = (typeof CALENDAR_ACTIVITY_STATUSES)[number];

export const ACTIVITY_STATUS_LABELS: Record<CalendarActivityStatus, string> = {
  none: "Nessuno",
  confirmed: "Confermato",
  pending: "Da confermare",
  lowReliability: "Non presentato",
  canceled: "Disdetto",
};

export const CALENDAR_OUTCOMES = [
  "CONTINUE_WITH_PROPOSAL",
  "CONTINUE_WITH_QUOTE",
  "ADDITIONAL_APPOINTMENT_SET",
  "FOLLOW_UP_SET",
  "AWAITING_CLIENT_FEEDBACK",
  "NOT_INTERESTED_FEATURES",
  "NOT_INTERESTED_PRICE",
  "OTHER",
] as const;
export type CalendarOutcome = (typeof CALENDAR_OUTCOMES)[number];

export const OUTCOME_LABELS: Record<CalendarOutcome, string> = {
  CONTINUE_WITH_PROPOSAL: "Continua con proposta",
  CONTINUE_WITH_QUOTE: "Continua con preventivo",
  ADDITIONAL_APPOINTMENT_SET: "Fissato ulteriore appuntamento",
  FOLLOW_UP_SET: "Ricontatto programmato",
  AWAITING_CLIENT_FEEDBACK: "In attesa di feedback dal cliente",
  NOT_INTERESTED_FEATURES: "Non interessato: caratteristiche immobile",
  NOT_INTERESTED_PRICE: "Non interessato: prezzo",
  OTHER: "Altro",
};
