/**
 * Fallisce con messaggio chiaro se la cartella design-system non è presente.
 * Senza di essa, tsc non risolve i path ../../design-system in tsconfig.json.
 */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(__dirname, "../../../design-system/package.json");

if (!existsSync(pkg)) {
  console.error(
    "[fe-followup-v3] Manca il design-system atteso in:\n  %s\n" +
      "La CI deve fare checkout del monorepo (incluso business/tecma-digital-platform/design-system).",
    pkg
  );
  process.exit(1);
}
