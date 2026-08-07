import crypto from 'node:crypto';

import type { Db } from 'mongodb';

/** Header HTTP per autenticazione server-to-server con workspace platform key (`wk_…`). */
export const WORKSPACE_PLATFORM_API_KEY_HEADER = 'x-workspace-platform-key';

export const hashWorkspacePlatformToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export type ResolvedWorkspacePlatformKey = {
  keyId: string;
  workspaceId: string;
  scopes: string[];
  projectIds: string[];
};

export async function resolveWorkspacePlatformKey(args: {
  db: Db;
  workspaceId: string;
  rawKey: string | undefined;
}): Promise<ResolvedWorkspacePlatformKey | null> {
  const raw = typeof args.rawKey === 'string' ? args.rawKey.trim() : '';
  if (raw.length === 0 || !raw.startsWith('wk_')) return null;
  const tokenHash = hashWorkspacePlatformToken(raw);
  const doc = (await args.db.collection('tz_workspace_platform_api_keys').findOne({
    tokenHash,
    workspaceId: args.workspaceId,
    status: 'active',
  })) as Record<string, unknown> | null;
  if (doc == null) return null;
  return {
    keyId: String(doc._id ?? ''),
    workspaceId: String(doc.workspaceId ?? ''),
    scopes: Array.isArray(doc.scopes) ? doc.scopes.map(String) : [],
    projectIds: Array.isArray(doc.projectIds) ? doc.projectIds.map(String) : [],
  };
}

/** Incremento atomico richieste riuscite per workspace/giorno/chiave (UTC date). */
export async function incrementWorkspacePlatformApiKeyUsage(args: {
  db: Db;
  workspaceId: string;
  platformApiKeyId: string;
}): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await args.db.collection('tz_workspace_platform_api_key_usage').updateOne(
    {
      workspaceId: args.workspaceId,
      day,
      platformApiKeyId: args.platformApiKeyId,
    },
    {
      $inc: { requests: 1 },
      $setOnInsert: {
        workspaceId: args.workspaceId,
        day,
        platformApiKeyId: args.platformApiKeyId,
        errors: 0,
      },
    },
    { upsert: true },
  );
}
