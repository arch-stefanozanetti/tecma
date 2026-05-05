import type { Db } from 'mongodb';

const isBenignExistingIndexConflict = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const codeName =
    'codeName' in error ? String((error as { codeName?: unknown }).codeName ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (
    codeName === 'IndexOptionsConflict' && message.includes('already exists with a different name')
  );
};

/** Indice unique non creabile finché esistono documenti duplicati sulla chiave (es. stesso workspaceId+code). */
const isDuplicateKeyBlockingUniqueIndexBuild = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: number }).code;
  const msg = String((error as { message?: string }).message ?? '');
  return (
    code === 11000 &&
    (msg.includes('duplicate key') || msg.includes('DuplicateKey')) &&
    (msg.includes('index') || msg.includes('Index build'))
  );
};

const ensureIndex = async (
  db: Db,
  collectionName: string,
  keys: Record<string, 1 | -1>,
  options: Record<string, unknown>,
): Promise<void> => {
  try {
    await db.collection(collectionName).createIndex(keys, options);
  } catch (error) {
    if (isBenignExistingIndexConflict(error)) {
      return;
    }
    if (isDuplicateKeyBlockingUniqueIndexBuild(error)) {
      const msg = `[ensureIndexes] indice unique non creato su ${collectionName} (duplicati nel DB): avvio comunque; dedup e riavvio ripristinano l’indice.`;
      if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        console.error(msg);
      } else {
        console.warn(msg);
      }
      return;
    }
    throw error;
  }
};

export const ensureCoreIndexes = async (db: Db): Promise<void> => {
  await ensureIndex(db, 'tz_users', { email: 1 }, { unique: true, name: 'tz_users_email_unique' });

  await ensureIndex(db, 'tz_user_workspaces', { workspaceId: 1, userId: 1 }, { unique: true });

  await ensureIndex(
    db,
    'tz_workspace_user_projects',
    { workspaceId: 1, userId: 1, projectId: 1 },
    { unique: true },
  );

  await ensureIndex(
    db,
    'tz_workspace_entitlements',
    { workspaceId: 1, feature: 1 },
    { unique: true },
  );

  await ensureIndex(
    db,
    'tz_workspace_projects',
    { workspaceId: 1, projectId: 1 },
    { unique: true },
  );

  await ensureIndex(
    db,
    'tz_projects',
    { workspaceId: 1, code: 1 },
    { unique: true, name: 'tz_projects_workspace_code_unique' },
  );

  await ensureIndex(
    db,
    'tz_workspaces',
    { owner_user_id: 1 },
    { name: 'tz_workspaces_owner_user_id_idx' },
  );

  await ensureIndex(
    db,
    'tz_project_access',
    { project_id: 1 },
    { name: 'tz_project_access_project_id_idx' },
  );

  await ensureIndex(
    db,
    'tz_authEvents',
    { createdAt: -1 },
    { name: 'tz_authEvents_createdAt_idx' },
  );

  await ensureIndex(db, 'tz_users', { status: 1 }, { name: 'tz_users_status_idx' });

  await ensureIndex(db, 'tz_users', { systemRole: 1 }, { name: 'tz_users_systemRole_idx' });

  await ensureIndex(db, 'tz_authSessions', { expiresAt: 1 }, { expireAfterSeconds: 0 });

  await ensureIndex(
    db,
    'tz_authSessions',
    { refreshTokenHash: 1 },
    { unique: true, name: 'tz_authSessions_refreshTokenHash_unique' },
  );

  await ensureIndex(
    db,
    'tz_authSessions',
    { sessionId: 1 },
    { unique: true, name: 'tz_authSessions_sessionId_unique' },
  );

  await ensureIndex(
    db,
    'tz_workspace_user_projects',
    { userId: 1, workspaceId: 1 },
    { name: 'tz_workspace_user_projects_user_workspace_idx' },
  );

  await ensureIndex(
    db,
    'tz_workspace_user_projects',
    { projectId: 1 },
    { name: 'tz_workspace_user_projects_projectId_idx' },
  );

  await ensureIndex(
    db,
    'tz_workspace_projects',
    { projectId: 1 },
    { name: 'tz_workspace_projects_projectId_idx' },
  );

  // Override permessi per ruolo (catalogo POC).
  await ensureIndex(
    db,
    'tz_roleDefinitions',
    { roleKey: 1 },
    { unique: true, name: 'tz_roleDefinitions_roleKey_unique' },
  );

  // Multi-key index su tz_users.permissionsOverride per query RBAC future.
  await ensureIndex(
    db,
    'tz_users',
    { permissionsOverride: 1 },
    { name: 'tz_users_permissionsOverride_idx', sparse: true },
  );

  // Workspace assets (M2): query per workspace + sort cronologico, status filter.
  await ensureIndex(
    db,
    'tz_assets',
    { workspaceId: 1, createdAt: -1 },
    { name: 'tz_assets_workspace_createdAt_idx' },
  );
  await ensureIndex(db, 'tz_assets', { status: 1 }, { name: 'tz_assets_status_idx' });
  await ensureIndex(
    db,
    'tz_assets',
    { workspaceId: 1, kind: 1 },
    { name: 'tz_assets_workspace_kind_idx' },
  );

  // Workspace entitlements / branding / ai-config (M2 advanced workspaces):
  // tz_workspace_entitlements gia coperto sopra (workspaceId+feature unique).
  await ensureIndex(
    db,
    'tz_workspace_branding',
    { workspaceId: 1 },
    { unique: true, name: 'tz_workspace_branding_workspace_unique' },
  );
  await ensureIndex(
    db,
    'tz_workspace_ai_config',
    { workspaceId: 1 },
    { unique: true, name: 'tz_workspace_ai_config_workspace_unique' },
  );
  await ensureIndex(
    db,
    'tz_additional_infos',
    { workspaceId: 1, sortOrder: 1 },
    { name: 'tz_additional_infos_workspace_sort_idx' },
  );
};
