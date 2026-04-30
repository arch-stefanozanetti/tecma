/**
 * Template statico checklist consegna (MVP).
 * Gli `id` sono stabili: usati in DB e nelle patch.
 */
export type HandoverTemplateItem = {
  id: string;
  label: string;
  required: boolean;
};

export const HANDOVER_CHECKLIST_TEMPLATE: ReadonlyArray<HandoverTemplateItem> = [
  { id: "impianti", label: "Impianti elettrici e idraulici verificati", required: true },
  { id: "infissi", label: "Infissi, serramenti e vetri integri", required: true },
  { id: "planimetria", label: "Planimetria e box documenti consegnati", required: true },
  { id: "chiavi", label: "Chiavi, badge e codici accesso consegnati", required: true },
  { id: "riscaldamento", label: "Riscaldamento / climatizzazione provati", required: false },
  { id: "cucina", label: "Cucina e elettrodomesti funzionanti", required: false },
  { id: "bagni", label: "Sanitari e rubinetteria senza perdite", required: false },
  { id: "pareti", label: "Pavimenti, pareti e soffitti senza difetti evidenti", required: false },
  { id: "garage", label: "Posto auto / cantina / garage (se previsti)", required: false },
  { id: "regolamenti", label: "Regolamento condominiale e utenze spiegate", required: false },
];
