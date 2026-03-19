import type { Db, IndexDirection, IndexSpecification } from "mongodb";
import { getDb } from "./db.js";
import { logger } from "../observability/logger.js";

interface IndexDefinition {
  collection: string;
  keys: Record<string, IndexDirection> | IndexSpecification;
  options?: Parameters<Db["collection"]>[1] extends never ? never : Record<string, unknown>;
}

const CORE_INDEXES: IndexDefinition[] = [
  { collection: "tz_workspace_users", keys: { workspaceId: 1, userId: 1 }, options: { unique: true } },
  { collection: "tz_workspace_user_projects", keys: { workspaceId: 1, userId: 1, projectId: 1 }, options: { unique: true } },
  { collection: "tz_entity_assignments", keys: { workspaceId: 1, entityType: 1, entityId: 1, userId: 1 }, options: { unique: true } },
  { collection: "tz_entity_assignments", keys: { workspaceId: 1, userId: 1 } },

  { collection: "tz_inventory", keys: { unitId: 1 }, options: { unique: true } },
  { collection: "tz_inventory", keys: { workspaceId: 1 } },

  { collection: "tz_commercial_models", keys: { unitId: 1 } },
  { collection: "tz_commercial_models", keys: { workspaceId: 1 } },
  { collection: "tz_rate_plans", keys: { commercialModelId: 1 } },

  { collection: "tz_sale_prices", keys: { unitId: 1, validFrom: -1 } },
  { collection: "tz_sale_prices", keys: { ratePlanId: 1, validFrom: -1 } },
  { collection: "tz_monthly_rents", keys: { unitId: 1, validFrom: -1 } },
  { collection: "tz_monthly_rents", keys: { ratePlanId: 1, validFrom: -1 } },

  { collection: "tz_price_calendar", keys: { unitId: 1, date: 1 }, options: { unique: true } },
  { collection: "tz_contracts", keys: { requestId: 1 }, options: { unique: true } },
  { collection: "tz_contracts", keys: { unitId: 1 } },

  { collection: "tz_magic_links", keys: { tokenHash: 1 }, options: { unique: true } },
  { collection: "tz_magic_links", keys: { expiresAt: 1 } },
  { collection: "tz_magic_links", keys: { workspaceId: 1, clientId: 1 } },
  { collection: "tz_portal_sessions", keys: { accessTokenHash: 1 }, options: { unique: true } },
  { collection: "tz_portal_sessions", keys: { expiresAt: 1 } },
  { collection: "tz_portal_sessions", keys: { workspaceId: 1, clientId: 1 } },
  { collection: "tz_platform_api_usage", keys: { apiKey: 1, date: 1 }, options: { unique: true } },
  { collection: "tz_portal_access_audit", keys: { at: -1 } },
];

function createIndexName(collection: string, keys: IndexDefinition["keys"]): string {
  const parts = Object.entries(keys).map(([k, v]) => `${k}_${String(v)}`);
  return `${collection}__${parts.join("__")}`;
}

export async function ensureCoreIndexes(db: Db = getDb()): Promise<void> {
  for (const index of CORE_INDEXES) {
    const indexName = createIndexName(index.collection, index.keys);
    try {
      await db.collection(index.collection).createIndex(index.keys, {
        name: indexName,
        ...(index.options ?? {}),
      });
    } catch (err) {
      logger.error(
        { err, collection: index.collection, indexName, keys: index.keys },
        "[db] ensureCoreIndexes createIndex failed"
      );
      throw err;
    }
  }

  logger.info({ count: CORE_INDEXES.length }, "[db] ensureCoreIndexes completed");
}
