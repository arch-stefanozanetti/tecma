/**
 * Storybook usa glob sul path della config: `[` e `]` nel percorso (es. cartella [GITHUB])
 * fanno fallire la ricerca di .storybook/main.js (SB_CORE-SERVER_0006).
 */
const cwd = process.cwd();
if (cwd.includes("[") || cwd.includes("]")) {
  console.error("\n[design-system] Storybook non funziona se il percorso contiene [ o ].\n");
  console.error("Percorso attuale:", cwd);
  console.error("\nSoluzione rapida — symlink senza parentesi:\n");
  const safe = `${process.env.HOME || "/tmp"}/tecma-design-system-link`;
  console.error(`  mkdir -p "${safe.replace(/\/tecma-design-system-link$/, "")}"`);
  console.error(`  ln -sfn "${cwd}" "${safe}"`);
  console.error(`  cd "${safe}" && npm run storybook\n`);
  process.exit(1);
}
