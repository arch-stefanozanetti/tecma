import type { RequestStatus } from "../types/domain";

/** Label per stato trattativa (fallback quando non c'è workflow config da API). */
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "Nuova",
  contacted: "Contattato",
  viewing: "Visita",
  quote: "Preventivo",
  offer: "Offerta",
  won: "Vinto",
  lost: "Perso",
};

/** Transizioni consentite per stato (fallback quando non c'è workflow config da API). */
export const REQUEST_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  new: ["contacted", "viewing", "lost"],
  contacted: ["viewing", "quote", "offer", "lost"],
  viewing: ["quote", "offer", "contacted", "lost"],
  quote: ["offer", "viewing", "lost"],
  offer: ["won", "lost", "viewing", "quote"],
  won: [],
  lost: [],
};

/** Ordine stati per roadmap/stepper (fallback). */
export const REQUEST_STATUS_ORDER: RequestStatus[] = [
  "new",
  "contacted",
  "viewing",
  "quote",
  "offer",
  "won",
  "lost",
];
