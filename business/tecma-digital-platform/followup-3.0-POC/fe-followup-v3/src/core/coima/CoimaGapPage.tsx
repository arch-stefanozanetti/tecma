import { CoimaPresentation } from "./CoimaPresentation";

/** Pagina assessment COIMA / BTS: presentazione interattiva (grafici, Gantt, matrice filtrabile). */
export function CoimaGapPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CoimaPresentation />
    </div>
  );
}
