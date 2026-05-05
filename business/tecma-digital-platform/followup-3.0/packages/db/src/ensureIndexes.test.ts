import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureCoreIndexes } from './ensureIndexes.js';

const makeDb = (createIndex = vi.fn().mockResolvedValue('ok')) =>
  ({
    collection: vi.fn((name: string) => ({
      collectionName: name,
      createIndex,
    })),
  }) as any;

describe('ensureCoreIndexes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the core indexes in order', async () => {
    const createIndex = vi.fn().mockResolvedValue('ok');
    const db = makeDb(createIndex);

    await ensureCoreIndexes(db);

    expect(createIndex).toHaveBeenCalledTimes(35);
    expect(db.collection).toHaveBeenNthCalledWith(1, 'tz_users');
    expect(createIndex).toHaveBeenNthCalledWith(
      1,
      { email: 1 },
      { unique: true, name: 'tz_users_email_unique' },
    );
    expect(db.collection).toHaveBeenNthCalledWith(18, 'tz_roleDefinitions');
    expect(db.collection).toHaveBeenNthCalledWith(19, 'tz_users');
    expect(db.collection).toHaveBeenNthCalledWith(20, 'tz_assets');
    expect(db.collection).toHaveBeenNthCalledWith(21, 'tz_assets');
    expect(db.collection).toHaveBeenNthCalledWith(22, 'tz_assets');
    expect(db.collection).toHaveBeenNthCalledWith(23, 'tz_workspace_branding');
    expect(db.collection).toHaveBeenNthCalledWith(24, 'tz_workspace_ai_config');
    expect(db.collection).toHaveBeenNthCalledWith(25, 'tz_additional_infos');
    expect(db.collection).toHaveBeenNthCalledWith(26, 'tz_project_branding');
    expect(db.collection).toHaveBeenNthCalledWith(27, 'tz_project_policies');
    expect(db.collection).toHaveBeenNthCalledWith(28, 'tz_project_marketing_settings');
    expect(db.collection).toHaveBeenNthCalledWith(29, 'tz_project_workflow_settings');
    expect(db.collection).toHaveBeenNthCalledWith(30, 'tz_project_email_config');
    expect(db.collection).toHaveBeenNthCalledWith(31, 'tz_project_legacy_overrides');
    expect(db.collection).toHaveBeenNthCalledWith(32, 'tz_project_email_templates');
    expect(db.collection).toHaveBeenNthCalledWith(33, 'tz_project_pdf_templates');
    expect(db.collection).toHaveBeenNthCalledWith(34, 'tz_workflows');
    expect(db.collection).toHaveBeenNthCalledWith(35, 'tz_workflow_configs');
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
    expect(createIndex).toHaveBeenCalledTimes(35);
  });

  it('logs and continues when duplicate data blocks a unique index build', async () => {
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
    expect(createIndex).toHaveBeenCalledTimes(35);
  });

  it('rethrows unexpected index creation errors', async () => {
    const error = new Error('network down');
    const createIndex = vi.fn().mockRejectedValue(error);

    await expect(ensureCoreIndexes(makeDb(createIndex))).rejects.toBe(error);
  });
});
