/**
 * Esempio — pattern di idempotenza per ETL pilota legacy → tz_*.
 * Non è importato dal runtime API; eseguire manualmente con `npx tsx` se necessario.
 * Runbook: docs/deliverables/PILOT_ETL_RUNBOOK.md
 */
import { MongoClient, type AnyBulkWriteOperation, type Document } from "mongodb";

export type LegacyRef = {
  legacySourceDb: string;
  legacyCollection: string;
  legacyId: string;
};

/** Chiave di filtro per upsert idempotente su metadata annidata o root. */
export function legacyRefFilter(ref: LegacyRef): Document {
  return {
    $or: [
      {
        "migration.legacySourceDb": ref.legacySourceDb,
        "migration.legacyCollection": ref.legacyCollection,
        "migration.legacyId": ref.legacyId,
      },
      {
        legacySourceDb: ref.legacySourceDb,
        legacyCollection: ref.legacyCollection,
        legacyId: ref.legacyId,
      },
    ],
  };
}

export function migrationMetadata(ref: LegacyRef, pilotRunId: string): Document {
  return {
    migration: {
      ...ref,
      pilotRunId,
      migratedAt: new Date().toISOString(),
    },
  };
}

/**
 * Esempio: bulkWrite con replaceOne + upsert true su collection tz_clients.
 * Adattare collection e $set al dominio reale.
 */
export function exampleClientUpserts(
  docs: Array<Document & { ref: LegacyRef }>,
  pilotRunId: string
): AnyBulkWriteOperation<Document>[] {
  return docs.map((d) => {
    const { ref, ...payload } = d;
    const filter = legacyRefFilter(ref);
    return {
      replaceOne: {
        filter,
        replacement: {
          ...payload,
          ...migrationMetadata(ref, pilotRunId),
        },
        upsert: true,
      },
    };
  });
}

/** Connessione tipica: due URI se sorgente e destinazione differiscono. */
export async function withClients<T>(
  targetUri: string,
  fn: (client: MongoClient) => Promise<T>
): Promise<T> {
  const client = new MongoClient(targetUri);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close();
  }
}
