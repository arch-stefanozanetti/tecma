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

const basePrefixNoTrail = (): string => (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

/**
 * Dopo SSO: `backTo` come da sessione (path tipo `/cockpit` o URL assoluto same-origin).
 * Evita redirect a `/` senza prefisso quando la SPA è sotto `base` (es. `/app/main/`).
 */
export function postAuthRedirectHref(backTo: string): string {
  const home = spaAbsolutePath("/");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = basePrefixNoTrail();

  let pathname = "/";
  let search = "";
  let hash = "";
  try {
    const raw = backTo.trim() || "/";
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (!origin || u.origin !== origin) return home;
      pathname = u.pathname || "/";
      search = u.search;
      hash = u.hash;
    } else {
      const u = new URL(raw, origin || "http://localhost");
      pathname = u.pathname || "/";
      search = u.search;
      hash = u.hash;
    }
  } catch {
    return home;
  }

  if (pathname.includes("/login")) return home;
  if (!base || base === "/") return `${pathname}${search}${hash}`;
  if (pathname.startsWith(base)) return `${pathname}${search}${hash}`;
  return `${spaAbsolutePath(pathname)}${search}${hash}`;
}
