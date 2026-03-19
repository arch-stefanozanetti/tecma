/**
 * Fallisce con messaggio chiaro se manca design-system o le sue dipendenze.
 * Il FE re-esporta sorgenti DS (`src/tecma-ds`): tsc risolve `react` da design-system/node_modules.
 */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dsRoot = resolve(__dirname, "../../../design-system");
const pkg = resolve(dsRoot, "package.json");
const reactPkg = resolve(dsRoot, "node_modules/react/package.json");

if (!existsSync(pkg)) {
  console.error(
    "[fe-followup-v3] Manca il design-system atteso in:\n  %s\n" +
      "La CI deve fare checkout del monorepo (incluso business/tecma-digital-platform/design-system).",
    pkg
  );
  process.exit(1);
}

if (!existsSync(reactPkg)) {
  console.error(
    "[fe-followup-v3] design-system presente ma senza node_modules (serve a TypeScript per i file in src/).\n" +
      "Esegui una volta:\n  cd business/tecma-digital-platform/design-system && npm ci\n" +
      "(in CI questo step è nel workflow Followup 3.0 CI.)"
  );
  process.exit(1);
}
