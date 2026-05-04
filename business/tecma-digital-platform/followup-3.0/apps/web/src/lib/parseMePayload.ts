/**
 * Normalizza la risposta di GET /v1/auth/me (anche varianti da proxy o id numerici).
 */
export function parseMePayload(raw: unknown): {
  id: string;
  email: string;
  systemRole: string;
} | null {
  if (raw == null || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const inner =
    root.data != null && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;
  const idRaw = inner.id ?? inner.sub;
  const emailRaw = inner.email;
  const roleRaw = inner.systemRole;
  let id: string | null = null;
  if (typeof idRaw === 'string' && idRaw.trim() !== '') id = idRaw.trim();
  else if (typeof idRaw === 'number' && Number.isFinite(idRaw)) id = String(idRaw);
  if (id == null) return null;
  if (typeof emailRaw !== 'string' || emailRaw.trim() === '') return null;
  const systemRole =
    typeof roleRaw === 'string' && roleRaw.trim() !== '' ? roleRaw.trim() : 'user';
  return {
    id,
    email: emailRaw.trim().toLowerCase(),
    systemRole,
  };
}
