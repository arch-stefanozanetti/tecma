/** Mappa nome file → SVG raw (Vite Storybook) */
const modules = import.meta.glob("./svg/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function getIconSvgSource(iconName: string, filled: boolean): string | undefined {
  if (filled) {
    const filledKey = `./svg/${iconName}-filled.svg`;
    if (modules[filledKey]) return modules[filledKey];
  }
  return modules[`./svg/${iconName}.svg`];
}
