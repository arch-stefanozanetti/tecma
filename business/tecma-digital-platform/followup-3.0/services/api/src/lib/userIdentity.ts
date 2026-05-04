import { ObjectId } from 'mongodb';

import type { FastifyInstance } from 'fastify';

type JwtUserLike = {
  sub?: string;
  email?: string;
};

/**
 * Raccoglie tutte le identità equivalenti per un utente (ObjectId string + email),
 * partendo dai seed disponibili nel JWT/query. Serve a gestire dataset legacy misti.
 */
export const resolveUserIdentityCandidates = async (
  app: FastifyInstance,
  seeds: Array<string | null | undefined>,
): Promise<string[]> => {
  const identities = new Set<string>();
  for (const seed of seeds) {
    if (typeof seed !== 'string') continue;
    const trimmed = seed.trim();
    if (trimmed === '') continue;
    identities.add(trimmed);
  }

  const current = Array.from(identities);
  for (const id of current) {
    if (id.includes('@')) {
      const byEmail = await app.mongoDb.collection('tz_users').findOne({ email: id });
      if (byEmail?._id != null) identities.add(String(byEmail._id));
      continue;
    }
    if (!ObjectId.isValid(id)) continue;
    const byId = await app.mongoDb.collection('tz_users').findOne({ _id: new ObjectId(id) } as any);
    if (typeof byId?.email === 'string' && byId.email.trim() !== '') identities.add(byId.email.trim());
  }

  return Array.from(identities);
};

export const isSelfIdentity = (
  user: JwtUserLike | undefined,
  requestedUserId: string | undefined,
): boolean => {
  if (requestedUserId == null) return false;
  const v = requestedUserId.trim();
  if (v === '') return false;
  return v === user?.sub || v === user?.email;
};
