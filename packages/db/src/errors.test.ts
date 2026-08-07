import { describe, expect, it } from 'vitest';

import { DatabaseGuardConfigurationError, ForbiddenDatabaseWriteError } from './errors.js';

describe('database guard errors', () => {
  it('formats forbidden write errors with machine-readable metadata', () => {
    const error = new ForbiddenDatabaseWriteError(
      'legacy',
      'test-zanetti',
      'insertOne',
      'tz_users',
    );

    expect(error.name).toBe('ForbiddenDatabaseWriteError');
    expect(error.code).toBe('ForbiddenDatabaseWriteError');
    expect(error.status).toBe(500);
    expect(error.message).toContain("Refused write operation 'insertOne'");
    expect(error.attemptedDb).toBe('legacy');
  });

  it('formats database guard configuration errors consistently', () => {
    const error = new DatabaseGuardConfigurationError('Mongo client not connected');

    expect(error.name).toBe('DatabaseGuardConfigurationError');
    expect(error.code).toBe('DatabaseGuardConfigurationError');
    expect(error.status).toBe(500);
    expect(error.message).toBe('Mongo client not connected');
  });
});
