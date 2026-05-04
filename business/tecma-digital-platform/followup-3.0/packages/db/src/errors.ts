export class ForbiddenDatabaseWriteError extends Error {
  public readonly code = 'ForbiddenDatabaseWriteError';
  public readonly status = 500;

  constructor(
    public readonly attemptedDb: string,
    public readonly allowedDb: string,
    public readonly operation: string,
    public readonly collectionName: string,
  ) {
    super(
      `Refused write operation '${operation}' on collection '${collectionName}' in database '${attemptedDb}'. Only '${allowedDb}' is writable.`,
    );
    this.name = 'ForbiddenDatabaseWriteError';
  }
}

export class DatabaseGuardConfigurationError extends Error {
  public readonly code = 'DatabaseGuardConfigurationError';
  public readonly status = 500;

  constructor(message: string) {
    super(message);
    this.name = 'DatabaseGuardConfigurationError';
  }
}
