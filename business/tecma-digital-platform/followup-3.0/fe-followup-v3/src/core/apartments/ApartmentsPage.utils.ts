import type { ApartmentRow } from "../../types/domain";

export type ModeFilter = "all" | "SELL" | "RENT";

export const MODE_TABS: { id: ModeFilter; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "SELL", label: "Vendita" },
  { id: "RENT", label: "Affitto" },
];

export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tutti gli stati" },
  { value: "AVAILABLE", label: "Disponibile" },
  { value: "RESERVED", label: "Riservato" },
  { value: "SOLD", label: "Venduto" },
  { value: "RENTED", label: "Affittato" },
];

export const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const pseudoFloor = (code: string) => {
  const codeSum = [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (codeSum % 8) + 1;
};

export const roomLabel = (surfaceMq: number) => {
  if (surfaceMq < 50) return "Monolocale";
  if (surfaceMq < 75) return "Trilocale";
  return "Quadrilocale";
};

export const availabilityInfo = (status: ApartmentRow["status"]) =>
  status === "AVAILABLE"
    ? { label: "Disponibile", className: "text-primary" }
    : { label: "Non disponibile", className: "text-destructive" };

export const statusLabelMap: Record<ApartmentRow["status"], string> = {
  AVAILABLE: "Disponibile",
  RESERVED: "Riservato",
  SOLD: "Venduto",
  RENTED: "Affittato",
};

export const statusInfo = (apt: ApartmentRow) => {
  if (apt.mode === "RENT") return { label: "Affitto", dot: "#8878C6" };
  if (apt.status === "AVAILABLE") return { label: "Disponibile", dot: "#65BFAF" };
  return { label: "Proposta", dot: "#F1904F" };
};
