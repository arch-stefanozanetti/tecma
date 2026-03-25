/** Prefisso path corrente della SPA (senza slash finale), da `import.meta.env.BASE_URL`. */
export function viteBasePrefix(baseUrl: string): string {
  const b = baseUrl ?? "/";
  if (b === "/" || b === "") return "";
  const trimmed = b.endsWith("/") ? b.slice(0, -1) : b;
  return trimmed;
}

export function pathWithoutBasePath(pathname: string, basePrefix: string): string {
  if (!basePrefix) return pathname;
  if (pathname === basePrefix) return "/";
  if (pathname.startsWith(`${basePrefix}/`)) {
    const rest = pathname.slice(basePrefix.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return pathname;
}

export function normalizeChannelBasePath(basePath: string): string {
  const t = basePath.trim();
  if (!t) return "/";
  const withLeading = t.startsWith("/") ? t : `/${t}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

/**
 * URL path + query + hash per passare a un altro canale (build sotto `basePath`), mantenendo route relativa alla SPA.
 */
export function buildChannelSwitchHref(
  targetBasePath: string,
  pathname: string,
  search: string,
  hash: string,
  currentBasePrefix: string
): string {
  const normalized = normalizeChannelBasePath(targetBasePath);
  const rootWithSlash = normalized;
  const rootNoTrail = rootWithSlash.length > 1 && rootWithSlash.endsWith("/") ? rootWithSlash.slice(0, -1) : rootWithSlash;

  const suffix = pathWithoutBasePath(pathname, currentBasePrefix);
  const pathPart =
    rootNoTrail === "" || rootNoTrail === "/"
      ? suffix
      : `${rootNoTrail}${suffix === "/" ? "/" : suffix}`;

  return `${pathPart}${search}${hash}`;
}

export function isDevChannelPickerEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.VITEST) return false;
  return import.meta.env.VITE_SHOW_DEV_CHANNEL_PICKER === "true";
}

export function devChannelsManifestUrl(): string {
  const u = import.meta.env.VITE_CHANNELS_MANIFEST_URL;
  return typeof u === "string" && u.trim() !== "" ? u.trim() : "/channels.json";
}
