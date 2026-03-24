/**
 * Path pathname completo sotto l’host, includendo il `base` Vite (deploy sotto `/app/<canale>/`).
 */
export function spaAbsolutePath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const rawBase = import.meta.env.BASE_URL || "/";
  if (rawBase === "/" || rawBase === "") return p;
  const baseNoTrail = rawBase.replace(/\/+$/, "");
  return `${baseNoTrail}${p}`;
}
