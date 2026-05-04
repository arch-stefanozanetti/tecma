import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const connect = vi.fn();
  const close = vi.fn();
  const command = vi.fn();
  const db = vi.fn();
  const warn = vi.fn();
  const MongoClient = vi.fn();
  return { MongoClient, connect, close, command, db, warn };
});

vi.mock('mongodb', () => ({
  MongoClient: mocks.MongoClient,
}));

vi.mock('@followup/logger', () => ({
  appLogger: {
    warn: mocks.warn,
  },
}));

import { FollowupMongoClient } from './MongoClient.js';
import { DatabaseGuardConfigurationError } from './errors.js';

describe('FollowupMongoClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    mocks.command.mockResolvedValue({ authInfo: { authenticatedUserPrivileges: [] } });
    mocks.db.mockImplementation((name: string) =>
      name === 'admin' ? { command: mocks.command } : { databaseName: name },
    );
    mocks.MongoClient.mockImplementation(() => ({
      connect: mocks.connect,
      close: mocks.close,
      db: mocks.db,
    }));
  });

  it('rejects a write database name outside the allowed guard before connecting', async () => {
    const client = new FollowupMongoClient({
      mongoUri: 'mongodb://localhost:27017',
      mongoDbName: 'legacy',
      nodeEnv: 'test',
    });

    await expect(client.connect()).rejects.toBeInstanceOf(DatabaseGuardConfigurationError);
    expect(mocks.MongoClient).not.toHaveBeenCalled();
  });

  it('exposes writable and read-only database handles after connect', async () => {
    const client = new FollowupMongoClient({
      mongoUri: 'mongodb://localhost:27017',
      mongoDbName: 'test-zanetti',
      nodeEnv: 'test',
    });

    await client.connect();

    expect(mocks.MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017');
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(client.getDb()).toEqual({ databaseName: 'test-zanetti' });
    expect(client.getReadOnlyDb('analytics')).toEqual({ databaseName: 'analytics' });
    expect(mocks.command).toHaveBeenCalledWith({ connectionStatus: 1, showPrivileges: true });
  });

  it('guards access before connect and resets state after close', async () => {
    const client = new FollowupMongoClient({
      mongoUri: 'mongodb://localhost:27017',
      mongoDbName: 'test-zanetti',
      nodeEnv: 'test',
    });

    expect(() => client.getDb()).toThrow(DatabaseGuardConfigurationError);
    expect(() => client.getReadOnlyDb('analytics')).toThrow(DatabaseGuardConfigurationError);

    await client.connect();
    await client.close();

    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(() => client.getDb()).toThrow(DatabaseGuardConfigurationError);
  });

  it('warns in non-production when Mongo privileges can write outside the allowed database', async () => {
    mocks.command.mockResolvedValue({
      authInfo: {
        authenticatedUserPrivileges: [
          { resource: { db: 'legacy' }, actions: ['find', 'insert'] },
        ],
      },
    });
    const client = new FollowupMongoClient({
      mongoUri: 'mongodb://localhost:27017',
      mongoDbName: 'test-zanetti',
      nodeEnv: 'development',
    });

    await client.connect();

    expect(mocks.warn).toHaveBeenCalledWith({
      event: 'db.privilege.warning',
      message: expect.stringContaining("outside 'test-zanetti'"),
    });
  });

  it('fails in production when Mongo privileges can write outside the allowed database', async () => {
    mocks.command.mockResolvedValue({
      authInfo: {
        authenticatedUserPrivileges: [
          { resource: { db: 'legacy' }, actions: ['remove'] },
        ],
      },
    });
    const client = new FollowupMongoClient({
      mongoUri: 'mongodb://localhost:27017',
      mongoDbName: 'test-zanetti',
      nodeEnv: 'production',
    });

    await expect(client.connect()).rejects.toBeInstanceOf(DatabaseGuardConfigurationError);
  });
});
