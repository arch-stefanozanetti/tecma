import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureCoreIndexes } from './ensureIndexes.js';

const makeDb = (
  createIndex = vi.fn().mockResolvedValue('ok'),
  dropIndex = vi.fn().mockResolvedValue('ok'),
) =>
  ({
    collection: vi.fn((name: string) => ({
      collectionName: name,
      createIndex,
      dropIndex,
    })),
  }) as any;

describe('ensureCoreIndexes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('creates the core indexes in order', async () => {
    const createIndex = vi.fn().mockResolvedValue('ok');
    const db = makeDb(createIndex);

    await ensureCoreIndexes(db);

    expect(createIndex).toHaveBeenCalledTimes(67);
    expect(db.collection).toHaveBeenNthCalledWith(1, 'tz_users');
    expect(db.collection('tz_users').dropIndex).toHaveBeenCalledWith('tz_users_email_unique');
    expect(createIndex).toHaveBeenNthCalledWith(
      1,
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
    expect(createIndex).toHaveBeenNthCalledWith(
      2,
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
    expect(db.collection).toHaveBeenCalledWith('tz_auth_login_guards');
    expect(db.collection).toHaveBeenCalledWith('tz_roleDefinitions');
    expect(db.collection).toHaveBeenCalledWith('tz_assets');
    expect(db.collection).toHaveBeenCalledWith('tz_workspace_entity_assignments');
    expect(db.collection).toHaveBeenCalledWith('tz_workspace_platform_api_keys');
    expect(db.collection).toHaveBeenCalledWith('tz_inviteTokens');
    expect(db.collection).toHaveBeenCalledWith('tz_project_branding');
    expect(db.collection).toHaveBeenCalledWith('tz_project_email_templates');
    expect(db.collection).toHaveBeenCalledWith('tz_i18n_global_bundles');
    expect(db.collection).toHaveBeenCalledWith('tz_i18n_workspace_bundles');
    expect(createIndex).toHaveBeenCalledWith(
      { workspaceId: 1, status: 1, projectId: 1 },
      { name: 'tz_workspace_projects_workspace_status_project_idx' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { project_id: 1, workspace_id: 1, status: 1 },
      { name: 'tz_project_access_project_workspace_status_idx' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { projectId: 1, status: 1, createdAt: -1 },
      { name: 'tz_project_email_templates_project_status_createdAt_idx' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { workspaceId: 1, connector: 1 },
      { unique: true, name: 'tz_connector_configs_workspace_connector_unique' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { unitId: 1, validFrom: -1 },
      { name: 'tz_sale_prices_unit_validFrom_idx' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { unitId: 1, validFrom: -1 },
      { name: 'tz_monthly_rents_unit_validFrom_idx' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { unitId: 1 },
      { unique: true, name: 'tz_inventory_unit_unique' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { unitId: 1, date: 1 },
      { unique: true, name: 'tz_price_calendar_unit_date_unique' },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { scope: 1, key: 1 },
      { unique: true, name: 'tz_idempotency_keys_scope_key_unique' },
    );
  });

  it('ignores benign existing index name conflicts', async () => {
    const createIndex = vi
      .fn()
      .mockRejectedValueOnce({
        codeName: 'IndexOptionsConflict',
        message: 'Index already exists with a different name',
      })
      .mockResolvedValue('ok');

    await expect(ensureCoreIndexes(makeDb(createIndex))).resolves.toBeUndefined();
    expect(createIndex).toHaveBeenCalledTimes(67);
  });

  it('logs and continues in development when duplicate data blocks a unique index build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const createIndex = vi
      .fn()
      .mockRejectedValueOnce({
        code: 11000,
        message: 'Index build failed: duplicate key error collection: tz_projects index',
      })
      .mockResolvedValue('ok');

    await expect(ensureCoreIndexes(makeDb(createIndex))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('indice unique non creato'));
    expect(createIndex).toHaveBeenCalledTimes(67);
  });

  it('fails fast in production when duplicate data blocks a unique index build', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = {
      code: 11000,
      message: 'Index build failed: duplicate key error collection: tz_projects index',
    };
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const createIndex = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    await expect(ensureCoreIndexes(makeDb(createIndex))).rejects.toBe(error);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('indice unique non creato'));
    expect(createIndex).toHaveBeenCalledTimes(1);
  });

  it('rethrows unexpected index creation errors', async () => {
    const error = new Error('network down');
    const createIndex = vi.fn().mockRejectedValue(error);

    await expect(ensureCoreIndexes(makeDb(createIndex))).rejects.toBe(error);
  });
});
