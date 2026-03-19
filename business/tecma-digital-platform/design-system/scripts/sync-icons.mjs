/**
 * Copia SVG da fe-tecma-design-system-release e rigenera src/icons/iconNames.ts
 * Uso: node scripts/sync-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(
  root,
  "../fe-tecma-design-system-release/src/assets/svg"
);
const destDir = path.join(root, "src/icons/svg");
const namesOut = path.join(root, "src/icons/iconNames.ts");

if (!fs.existsSync(srcDir)) {
  console.error("Sorgente non trovata:", srcDir);
  process.exit(1);
}
fs.mkdirSync(destDir, { recursive: true });
for (const f of fs.readdirSync(srcDir)) {
  if (f.endsWith(".svg")) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
}
const names = fs
  .readdirSync(destDir)
  .filter((f) => f.endsWith(".svg"))
  .map((f) => f.slice(0, -4))
  .sort();
const content = `/** Auto-generato: npm run sync:icons */
export const ICON_NAMES = ${JSON.stringify(names, null, 2)} as const;
export type IconName = (typeof ICON_NAMES)[number];
`;
fs.writeFileSync(namesOut, content);
console.log("OK:", names.length, "icone → src/icons/svg + iconNames.ts");
