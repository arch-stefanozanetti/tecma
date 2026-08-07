import { ObjectId } from 'mongodb';

import type { FastifyInstance } from 'fastify';

type JwtUserLike = {
  sub?: string;
  email?: string;
};

/**
 * Raccoglie le identità stabili per un utente.
 *
 * Nota importante: con identità workspace-scoped la stessa email può esistere su
 * più utenti non-Tecma. Per questo l'email non è più un candidato equivalente
 * quando nel JWT è presente un `sub` stabile; viene usata solo come fallback
 * legacy e solo se risolve una singola identità.
 */
export const resolveUserIdentityCandidates = async (
  app: FastifyInstance,
  seeds: Array<string | null | undefined>,
): Promise<string[]> => {
  const identities = new Set<string>();
  const stableSeeds: string[] = [];
  const emailSeeds: string[] = [];
  for (const seed of seeds) {
    if (typeof seed !== 'string') continue;
    const trimmed = seed.trim();
    if (trimmed === '') continue;
    if (trimmed.includes('@')) {
      emailSeeds.push(trimmed.toLowerCase());
    } else {
      stableSeeds.push(trimmed);
      identities.add(trimmed);
    }
  }

  if (stableSeeds.length === 0) {
    for (const email of emailSeeds) {
      const matches = await app.mongoDb
        .collection('tz_users')
        .find({ email, status: { $ne: 'deleted' } } as any)
        .project({ _id: 1 })
        .toArray();
      if (matches.length === 1 && matches[0]?._id != null) {
        identities.add(String(matches[0]._id));
      }
    }
  }

  const current = Array.from(identities);
  const emailsFromStableIdentities = new Set<string>();
  for (const id of current) {
    if (!ObjectId.isValid(id)) continue;
    const byId = await app.mongoDb.collection('tz_users').findOne({ _id: new ObjectId(id) } as any);
    if (byId?._id != null) {
      identities.add(String(byId._id));
      const email = String((byId as { email?: unknown }).email ?? '')
        .trim()
        .toLowerCase();
      if (email !== '') emailsFromStableIdentities.add(email);
    }
  }

  for (const email of emailsFromStableIdentities) {
    const matches = await app.mongoDb
      .collection('tz_users')
      .find({ email, status: { $ne: 'deleted' } } as any)
      .project({ _id: 1 })
      .toArray();
    if (matches.length !== 1) continue;
    const matchedId = String(matches[0]?._id ?? '');
    if (identities.has(matchedId)) identities.add(email);
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
