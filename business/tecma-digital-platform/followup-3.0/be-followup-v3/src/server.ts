import cors from "cors";
import express from "express";
import { ENV, isProductionLike } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { ensureCoreIndexes } from "./config/ensureIndexes.js";
import { v1Router } from "./routes/v1.js";
import { platformRoutes } from "./routes/v1/platform.routes.js";
import { realtimeRoutes } from "./routes/v1/realtime.routes.js";
import { customerPortalPublicRoutes, customerPortalRoutes } from "./routes/v1/customer-portal.routes.js";
import { runDueScheduled } from "./core/communications/scheduled-communications.service.js";
import { runDueMarketingAutomations } from "./core/automations/marketing-automation.service.js";
import { runPrivacyRetentionJob } from "./core/privacy/privacy.service.js";
import { runGlobalMlsReconciliation } from "./core/connectors/mls-feed.service.js";
import { ensureDefaultRoleDefinitions } from "./core/rbac/roleDefinitions.service.js";
import { logger } from "./observability/logger.js";
import { initOtel, shutdownOtel } from "./observability/otel.js";
import { requestContextMiddleware } from "./routes/requestContextMiddleware.js";
import { requireAuth } from "./routes/authMiddleware.js";

const SCHEDULED_COMMS_INTERVAL_MS = 2 * 60 * 1000;
const MARKETING_AUTOMATION_INTERVAL_MS = 2 * 60 * 1000;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MLS_RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000;

function buildCorsOriginChecker(): (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void {
  const allowed = new Set<string>();
  const add = (u: string) => {
    try {
      allowed.add(new URL(u).origin);
    } catch {
      /* skip */
    }
  };
  add(ENV.APP_PUBLIC_URL);
  for (const part of ENV.CORS_ORIGINS.split(",")) {
    const t = part.trim();
    if (t) add(t.includes("://") ? t : `https://${t}`);
  }
  if (!isProductionLike()) {
    ["http://localhost:5173", "http://localhost:5177", "http://127.0.0.1:5173", "http://127.0.0.1:5177"].forEach((o) =>
      allowed.add(o)
    );
  }
  return (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (allowed.has(origin)) {
      cb(null, true);
      return;
    }
    cb(null, false);
  };
}

const bootstrap = async () => {
  await initOtel();
  await connectDb();
  await ensureCoreIndexes().catch((err) => {
    logger.error({ err }, "[db] ensureCoreIndexes failed");
    throw err;
  });
  await ensureDefaultRoleDefinitions().catch((err) => {
    logger.error({ err }, "[rbac] ensureDefaultRoleDefinitions failed");
  });

  setInterval(() => {
    runDueScheduled().catch((err) => {
      logger.error({ err }, "[scheduled-communications] runDueScheduled failed");
    });
  }, SCHEDULED_COMMS_INTERVAL_MS);

  setInterval(() => {
    runDueMarketingAutomations().catch((err) => {
      logger.error({ err }, "[marketing-automation] runDueMarketingAutomations failed");
    });
  }, MARKETING_AUTOMATION_INTERVAL_MS);

  setInterval(() => {
    runPrivacyRetentionJob({ olderThanDays: 365 }).catch((err) => {
      logger.error({ err }, "[privacy] runPrivacyRetentionJob failed");
    });
  }, RETENTION_INTERVAL_MS);

  setInterval(() => {
    runGlobalMlsReconciliation().catch((err) => {
      logger.error({ err }, "[mls] runGlobalMlsReconciliation failed");
    });
  }, MLS_RECONCILIATION_INTERVAL_MS);

  const app = express();
  app.use(requestContextMiddleware);
  app.use(
    cors({
      origin: buildCorsOriginChecker(),
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/v1", customerPortalPublicRoutes);
  app.use("/v1", requireAuth, customerPortalRoutes);
  app.use("/v1/platform", platformRoutes);
  app.use("/v1", realtimeRoutes);
  app.use("/v1", v1Router);

  const server = app.listen(ENV.PORT, () => {
    logger.info({ port: ENV.PORT }, "be-followup-v3 listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down be-followup-v3");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await shutdownOtel().catch((err) => logger.error({ err }, "OpenTelemetry shutdown failed"));
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

bootstrap().catch((error) => {
  logger.fatal({ err: error }, "Failed to start be-followup-v3");
  process.exit(1);
});
