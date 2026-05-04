/**
 * Nome database Mongo consentito per scritture (allineato a `MONGO_DB_NAME` / `ALLOWED_WRITE_DB` in `loadEnv`).
 * Valutato a runtime così CI e ambienti multipli possono usare lo stesso binario.
 */
export const getAllowedWriteDbName = (): string =>
  (process.env.ALLOWED_WRITE_DB ?? process.env.MONGO_DB_NAME ?? 'test-zanetti').trim();
