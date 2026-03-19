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
  { collection: "tz_platform_api_keys", keys: { keyHash: 1 }, options: { unique: true } },
  { collection: "tz_platform_api_keys", keys: { workspaceId: 1, active: 1 } },
  { collection: "tz_platform_api_keys", keys: { workspaceId: 1, label: 1 } },
  { collection: "tz_automation_dispatch_log", keys: { keyHash: 1 }, options: { unique: true } },
  { collection: "tz_automation_dispatch_log", keys: { workspaceId: 1, status: 1, updatedAt: -1 } },
  { collection: "tz_privacy_consents", keys: { workspaceId: 1, clientId: 1, consentType: 1 }, options: { unique: true } },
  { collection: "tz_privacy_consents", keys: { workspaceId: 1, updatedAt: -1 } },
  { collection: "tz_signature_requests", keys: { workspaceId: 1, requestId: 1, createdAt: -1 } },
  { collection: "tz_signature_requests", keys: { provider: 1, providerRequestId: 1 }, options: { unique: true } },
  { collection: "tz_marketing_workflows", keys: { workspaceId: 1, enabled: 1, triggerEventType: 1 } },
  { collection: "tz_marketing_enrollments", keys: { workspaceId: 1, status: 1, nextRunAt: 1 } },
  { collection: "tz_marketing_step_executions", keys: { executionKey: 1 }, options: { unique: true } },
  { collection: "tz_mls_portal_mappings", keys: { workspaceId: 1, projectId: 1, portal: 1 }, options: { unique: true } },
  { collection: "tz_mls_feed_runs", keys: { workspaceId: 1, projectId: 1, generatedAt: -1 } },
  { collection: "tz_operational_alerts", keys: { workspaceId: 1, acknowledgedAt: 1, createdAt: -1 } },
  { collection: "tz_operational_alerts", keys: { source: 1, severity: 1, createdAt: -1 } },
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
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: number }).code : undefined;
      if (code === 85) {
        logger.warn(
          { collection: index.collection, indexName, keys: index.keys },
          "[db] ensureCoreIndexes: index already exists with different name, skip"
        );
        continue;
      }
      logger.error(
        { err, collection: index.collection, indexName, keys: index.keys },
        "[db] ensureCoreIndexes createIndex failed"
      );
      throw err;
    }
  }

  logger.info({ count: CORE_INDEXES.length }, "[db] ensureCoreIndexes completed");
}
