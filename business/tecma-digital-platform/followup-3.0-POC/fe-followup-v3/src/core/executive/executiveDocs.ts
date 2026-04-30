/**
 * Contenuti raw da docs/executive (single source of truth nel monorepo followup-3.0).
 * Path relativo: da `src/core/executive` quattro `..` → root monorepo `followup-3.0/docs/executive`.
 * Vedi vite.config `server.fs.allow` per dev.
 */
import readme from "../../../../docs/executive/README.md?raw";
import doc01 from "../../../../docs/executive/01-executive-summary.md?raw";
import doc02 from "../../../../docs/executive/02-why-greenfield-vs-legacy.md?raw";
import doc03 from "../../../../docs/executive/03-domain-maturity-matrix.md?raw";
import doc04 from "../../../../docs/executive/04-architecture-at-a-glance.md?raw";
import doc05 from "../../../../docs/executive/05-privacy-gdpr-and-tenant-model.md?raw";
import doc06 from "../../../../docs/executive/06-risks-open-decisions.md?raw";
import doc07 from "../../../../docs/executive/07-legacy-migration-and-data-parity.md?raw";

export interface ExecutiveDocTab {
  id: string;
  label: string;
  markdown: string;
}

export const EXECUTIVE_DOC_TABS: ExecutiveDocTab[] = [
  { id: "readme", label: "Indice", markdown: readme },
  { id: "01", label: "Executive summary", markdown: doc01 },
  { id: "02", label: "Perché greenfield", markdown: doc02 },
  { id: "03", label: "Stadio domini", markdown: doc03 },
  { id: "04", label: "Architettura", markdown: doc04 },
  { id: "05", label: "Privacy e GDPR", markdown: doc05 },
  { id: "06", label: "Rischi e decisioni", markdown: doc06 },
  { id: "07", label: "Migrazione legacy", markdown: doc07 },
];
