/**
 * Nome database Mongo consentito per scritture (allineato a `MONGO_DB_NAME` / `ALLOWED_WRITE_DB` in `loadEnv`).
 * Valutato a runtime così CI e ambienti multipli possono usare lo stesso binario.
 */
export const getAllowedWriteDbName = (): string => {
  const allowedWriteDb = process.env.ALLOWED_WRITE_DB?.trim();
  if (allowedWriteDb == null || allowedWriteDb === '') {
    throw new Error('[DB_GUARD] ALLOWED_WRITE_DB is required');
  }
  return allowedWriteDb;
};
