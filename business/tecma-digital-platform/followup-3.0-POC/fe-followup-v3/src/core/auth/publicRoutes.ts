/** Rotte FE accessibili senza sessione (invito, reset password, login, link pubblici). */
export function isPublicAppRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/set-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/forgot-password") ||
    pathname.includes("/login") ||
    pathname.startsWith("/r/")
  );
}
