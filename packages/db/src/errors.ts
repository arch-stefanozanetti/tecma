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

/** Tentativo di mutazione su una collection audit append-only (es. `tz_authEvents`). */
export class AppendOnlyAuditMutationError extends Error {
  public readonly code = 'AppendOnlyAuditMutationError';
  public readonly status = 500;

  constructor(collectionName: string, operation: string) {
    super(`Append-only audit collection '${collectionName}' does not allow '${operation}'.`);
    this.name = 'AppendOnlyAuditMutationError';
  }
}
