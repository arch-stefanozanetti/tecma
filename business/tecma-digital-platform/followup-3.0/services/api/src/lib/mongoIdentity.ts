import { ObjectId } from 'mongodb';

/**
 * Valori per `$in` quando il campo in Mongo può essere **stringa** o **ObjectId** (dataset legacy).
 */
export function expandForStringOrObjectIdIn(identities: string[]): (string | ObjectId)[] {
  const out: (string | ObjectId)[] = [];
  /** Stringhe e ObjectId vanno tenuti separati: in BSON sono tipi diversi e Mongo confronta il tipo. */
  const seenStrings = new Set<string>();
  const seenObjectIdHex = new Set<string>();
  const pushString = (id: string) => {
    if (seenStrings.has(id)) return;
    seenStrings.add(id);
    out.push(id);
  };
  const pushOid = (oid: ObjectId) => {
    const h = oid.toHexString();
    if (seenObjectIdHex.has(h)) return;
    seenObjectIdHex.add(h);
    out.push(oid);
  };

  for (const raw of identities) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (id === '') continue;
    pushString(id);
    if (ObjectId.isValid(id)) {
      try {
        pushOid(new ObjectId(id));
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

/** Normalizza `workspaceId` / `_id` letti da documenti membership (stringa o ObjectId). */
export function normalizeToStringId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (value instanceof ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const s = String(value);
    if (s.length > 0 && !s.startsWith('[object ')) return s;
  }
  return null;
}

/** Varianti stringa/ObjectId per il campo `workspaceId` nelle query. */
export function workspaceIdFieldFilter(workspaceId: string): Record<string, unknown> {
  const t = workspaceId.trim();
  const strings: string[] = [];
  const oids: ObjectId[] = [];
  const seenStr = new Set<string>();
  const seenOidHex = new Set<string>();
  if (t !== '' && !seenStr.has(t)) {
    seenStr.add(t);
    strings.push(t);
  }
  if (ObjectId.isValid(t)) {
    try {
      const oid = new ObjectId(t);
      const h = oid.toHexString();
      if (!seenOidHex.has(h)) {
        seenOidHex.add(h);
        oids.push(oid);
      }
    } catch {
      /* ignore */
    }
  }
  const variants: (string | ObjectId)[] = [...strings, ...oids];
  if (variants.length === 1) {
    return { workspaceId: variants[0] };
  }
  return { workspaceId: { $in: variants } };
}

/** Filtro membership `tz_user_workspaces` con utente + workspace allineati ai tipi legacy. */
export function buildUserWorkspaceMembershipFilter(
  workspaceId: string,
  identityStrings: string[],
): Record<string, unknown> {
  return {
    ...workspaceIdFieldFilter(workspaceId),
    userId: { $in: expandForStringOrObjectIdIn(identityStrings) },
  };
}
