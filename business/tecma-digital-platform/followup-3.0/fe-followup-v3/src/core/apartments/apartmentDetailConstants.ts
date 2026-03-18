import type { ApartmentRow } from "../../types/domain";

export const STATUS_FILTER_OPTIONS: { value: ApartmentRow["status"]; label: string }[] = [
  { value: "AVAILABLE", label: "Disponibile" },
  { value: "RESERVED", label: "Riservato" },
  { value: "SOLD", label: "Venduto" },
  { value: "RENTED", label: "Affittato" },
];

export const STATUS_LABEL: Record<ApartmentRow["status"], string> = {
  AVAILABLE: "Disponibile",
  RESERVED: "Riservato",
  SOLD: "Venduto",
  RENTED: "Affittato",
};

export const MODE_LABEL: Record<ApartmentRow["mode"], string> = {
  RENT: "Affitto",
  SELL: "Vendita",
};
