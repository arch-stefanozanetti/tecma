/**
 * Genera docs/CAPABILITY_INDEX_FOLLOWUP_3.md da FEATURE_CATALOG (stesso ordine logico della UI Epic).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURE_CATALOG } from "../src/core/jira-prd/feature-catalog.js";
import { EPIC_IDS } from "../src/core/jira-prd/epic-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../../docs/CAPABILITY_INDEX_FOLLOWUP_3.md");

function epicSortIndex(epicId: string): number {
  const i = EPIC_IDS.indexOf(epicId as (typeof EPIC_IDS)[number]);
  return i === -1 ? 999 : i;
}

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const sorted = [...FEATURE_CATALOG].sort((a, b) => {
  const ea = epicSortIndex(a.epicId);
  const eb = epicSortIndex(b.epicId);
  if (ea !== eb) return ea - eb;
  const ga = a.parentIdTema ?? a.idTema;
  const gb = b.parentIdTema ?? b.idTema;
  if (ga !== gb) return ga.localeCompare(gb);
  const da = a.parentIdTema ? 1 : 0;
  const db = b.parentIdTema ? 1 : 0;
  if (da !== db) return da - db;
  return a.idTema.localeCompare(b.idTema);
});

const lines: string[] = [];
lines.push("# Indice capability Followup 3.0 (generato)");
lines.push("");
lines.push("> Generato da `yarn docs:capability-index` nella cartella `be-followup-v3`. Non modificare a mano.");
lines.push("");
lines.push("| idTema | Area | Epic | Kind | Sintesi | designRefs |");
lines.push("|--------|------|------|------|---------|------------|");

for (const e of sorted) {
  const design =
    e.designRefs && e.designRefs.length > 0 ? escCell(e.designRefs.join(", ")) : "—";
  lines.push(
    `| ${escCell(e.idTema)} | ${escCell(e.areaPrefix)} | ${escCell(e.epicId)} | ${escCell(e.kind)} | ${escCell(e.summary)} | ${design} |`
  );
}

lines.push("");
lines.push("Vedi anche [CATALOG_FOR_LLM.md](./CATALOG_FOR_LLM.md) per uso con LLM.");

writeFileSync(OUT, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${OUT}`);
