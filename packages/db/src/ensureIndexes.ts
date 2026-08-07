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
      const msg = `[ensureIndexes] indice unique non creato su ${collectionName} (duplicati nel DB): dedup obbligatoria prima dell'avvio in ambienti production-like.`;
      if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        console.error(msg);
        throw error;
      } else {
        console.warn(msg);
      }
      return;
    }
    throw error;
  }
};

const dropIndexIfExists = async (
  db: Db,
  collectionName: string,
  indexName: string,
): Promise<void> => {
  try {
    await db.collection(collectionName).dropIndex(indexName);
  } catch (error) {
    const codeName =
      error && typeof error === 'object'
        ? String((error as { codeName?: unknown }).codeName ?? '')
        : '';
    const message =
      error && typeof error === 'object'
        ? String((error as { message?: unknown }).message ?? '')
        : '';
    if (
      codeName === 'IndexNotFound' ||
      codeName === 'NamespaceNotFound' ||
      message.includes('index not found') ||
      message.includes('index not found with name') ||
      message.includes('ns not found')
    ) {
      return;
    }
    throw error;
  }
};

export const ensureCoreIndexes = async (db: Db): Promise<void> => {
  await dropIndexIfExists(db, 'tz_users', 'tz_users_email_unique');
  await ensureIndex(
    db,
    'tz_users',
    { homeWorkspaceId: 1, email: 1 },
    {
      unique: true,
      name: 'tz_users_homeWorkspace_email_unique',
      partialFilterExpression: {
        homeWorkspaceId: { $exists: true },
        status: { $in: ['active', 'invited', 'deactivated', 'suspended'] },
      },
    },
  );
  await ensureIndex(
    db,
    'tz_users',
    { email: 1 },
    {
      unique: true,
      name: 'tz_users_tecma_email_unique',
      partialFilterExpression: {
        systemRole: 'tecma_admin',
        status: { $in: ['active', 'invited', 'deactivated', 'suspended'] },
      },
    },
  );

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
    'tz_project_access',
    { project_id: 1, workspace_id: 1 },
    {
      unique: true,
      partialFilterExpression: { status: 'active' },
      name: 'tz_project_access_project_workspace_active_unique',
    },
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

  // TTL sui login guard: pulizia automatica dopo 2 ore (lockMinutes max è 15m, margine ampio).
  await ensureIndex(
    db,
    'tz_auth_login_guards',
    { createdAt: 1 },
    { expireAfterSeconds: 7200, name: 'tz_auth_login_guards_ttl' },
  );

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
    'tz_authRevokedTokens',
    { jti: 1 },
    { unique: true, name: 'tz_authRevokedTokens_jti_unique' },
  );
  await ensureIndex(
    db,
    'tz_authRevokedTokens',
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'tz_authRevokedTokens_expiresAt_ttl' },
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
  await ensureIndex(
    db,
    'tz_workspace_entity_assignments',
    { workspaceId: 1, entityType: 1, entityId: 1, userId: 1 },
    { unique: true, name: 'tz_workspace_entity_assignments_unique' },
  );
  await ensureIndex(
    db,
    'tz_workspace_entity_assignments',
    { workspaceId: 1, userId: 1 },
    { name: 'tz_workspace_entity_assignments_workspace_user_idx' },
  );
  await ensureIndex(
    db,
    'tz_workspace_platform_api_keys',
    { workspaceId: 1, status: 1 },
    { name: 'tz_workspace_platform_api_keys_workspace_status_idx' },
  );
  await ensureIndex(
    db,
    'tz_workspace_platform_api_keys',
    { tokenHash: 1 },
    { unique: true, name: 'tz_workspace_platform_api_keys_token_hash_unique' },
  );
  await ensureIndex(
    db,
    'tz_workspace_platform_api_key_usage',
    { workspaceId: 1, day: 1 },
    { name: 'tz_workspace_platform_api_key_usage_workspace_day_idx' },
  );
  await ensureIndex(
    db,
    'tz_workspace_platform_api_key_usage',
    { workspaceId: 1, day: 1, platformApiKeyId: 1 },
    { name: 'tz_workspace_platform_api_key_usage_workspace_day_key_idx' },
  );

  // Workspace invitations: lookup by workspace/user/status + token uniqueness + TTL cleanup.
  await ensureIndex(
    db,
    'tz_inviteTokens',
    { workspaceId: 1, userId: 1, status: 1 },
    { name: 'tz_inviteTokens_workspace_user_status_idx' },
  );
  await ensureIndex(
    db,
    'tz_inviteTokens',
    { tokenHash: 1 },
    { unique: true, name: 'tz_inviteTokens_token_hash_unique' },
  );
  await ensureIndex(
    db,
    'tz_inviteTokens',
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'tz_inviteTokens_expiresAt_ttl' },
  );

  // Project Detail (M3): unique constraints on per-project singleton sections + templates.
  await ensureIndex(
    db,
    'tz_project_branding',
    { projectId: 1 },
    { unique: true, name: 'tz_project_branding_project_unique' },
  );
  await ensureIndex(
    db,
    'tz_project_policies',
    { projectId: 1 },
    { unique: true, name: 'tz_project_policies_project_unique' },
  );
  await ensureIndex(
    db,
    'tz_project_marketing_settings',
    { projectId: 1 },
    { unique: true, name: 'tz_project_marketing_settings_project_unique' },
  );
  await ensureIndex(
    db,
    'tz_project_workflow_settings',
    { projectId: 1 },
    { unique: true, name: 'tz_project_workflow_settings_project_unique' },
  );
  await ensureIndex(
    db,
    'tz_project_email_config',
    { projectId: 1 },
    { unique: true, name: 'tz_project_email_config_project_unique' },
  );
  await ensureIndex(
    db,
    'tz_project_legacy_overrides',
    { projectId: 1 },
    { unique: true, name: 'tz_project_legacy_overrides_project_unique' },
  );
  await ensureIndex(
    db,
    'tz_project_email_templates',
    { projectId: 1, name: 1 },
    { unique: true, name: 'tz_project_email_templates_project_name_unique' },
  );
  await ensureIndex(
    db,
    'tz_project_pdf_templates',
    { projectId: 1, templateKey: 1 },
    { unique: true, name: 'tz_project_pdf_templates_project_templateKey_unique' },
  );
  await ensureIndex(
    db,
    'tz_workflows',
    { workspaceId: 1 },
    { name: 'tz_workflows_workspaceId_idx' },
  );
  await ensureIndex(
    db,
    'tz_workflow_configs',
    { workspaceId: 1, projectId: 1, flowType: 1 },
    { name: 'tz_workflow_configs_lookup_idx' },
  );

  // Email flows (sistema-level): template di sistema override per flowKey.
  await ensureIndex(
    db,
    'tz_email_flows',
    { flowKey: 1 },
    { unique: true, name: 'tz_email_flows_flowKey_unique' },
  );

  // i18n: bundle per (locale, namespace) globale e override workspace.
  await ensureIndex(
    db,
    'tz_i18n_global_bundles',
    { locale: 1, namespace: 1 },
    { unique: true, name: 'tz_i18n_global_bundles_locale_ns_unique' },
  );
  await ensureIndex(
    db,
    'tz_i18n_workspace_bundles',
    { workspaceId: 1, locale: 1, namespace: 1 },
    { unique: true, name: 'tz_i18n_workspace_bundles_workspace_locale_ns_unique' },
  );

  // Query secondarie Projects/connector/idempotenza: non cambiano i vincoli primari,
  // ma rendono veloci liste, grant e lookup usati dai domini PR40.
  await ensureIndex(
    db,
    'tz_workspace_projects',
    { workspaceId: 1, status: 1, projectId: 1 },
    { name: 'tz_workspace_projects_workspace_status_project_idx' },
  );
  await ensureIndex(
    db,
    'tz_workspace_projects',
    { projectId: 1, status: 1 },
    { name: 'tz_workspace_projects_project_status_idx' },
  );
  await ensureIndex(
    db,
    'tz_projects',
    { workspaceId: 1, status: 1, updatedAt: -1 },
    { name: 'tz_projects_workspace_status_updatedAt_idx' },
  );
  await ensureIndex(
    db,
    'tz_project_access',
    { project_id: 1, role: 1, status: 1 },
    { name: 'tz_project_access_project_role_status_idx' },
  );
  await ensureIndex(
    db,
    'tz_project_access',
    { workspace_id: 1, status: 1 },
    { name: 'tz_project_access_workspace_status_idx' },
  );
  await ensureIndex(
    db,
    'tz_project_access',
    { project_id: 1, workspace_id: 1, status: 1 },
    { name: 'tz_project_access_project_workspace_status_idx' },
  );
  await ensureIndex(
    db,
    'tz_project_email_templates',
    { projectId: 1, status: 1, createdAt: -1 },
    { name: 'tz_project_email_templates_project_status_createdAt_idx' },
  );
  await ensureIndex(
    db,
    'tz_project_pdf_templates',
    { projectId: 1, status: 1, createdAt: -1 },
    { name: 'tz_project_pdf_templates_project_status_createdAt_idx' },
  );
  await ensureIndex(
    db,
    'tz_connector_configs',
    { workspaceId: 1, connector: 1 },
    { unique: true, name: 'tz_connector_configs_workspace_connector_unique' },
  );
  await ensureIndex(
    db,
    'tz_sale_prices',
    { unitId: 1, validFrom: -1 },
    { name: 'tz_sale_prices_unit_validFrom_idx' },
  );
  await ensureIndex(
    db,
    'tz_monthly_rents',
    { unitId: 1, validFrom: -1 },
    { name: 'tz_monthly_rents_unit_validFrom_idx' },
  );
  await ensureIndex(
    db,
    'tz_inventory',
    { unitId: 1 },
    { unique: true, name: 'tz_inventory_unit_unique' },
  );
  await ensureIndex(
    db,
    'tz_price_calendar',
    { unitId: 1, date: 1 },
    { unique: true, name: 'tz_price_calendar_unit_date_unique' },
  );
  await ensureIndex(
    db,
    'tz_idempotency_keys',
    { scope: 1, key: 1 },
    { unique: true, name: 'tz_idempotency_keys_scope_key_unique' },
  );
  await ensureIndex(
    db,
    'tz_idempotency_keys',
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'tz_idempotency_keys_ttl' },
  );
};
