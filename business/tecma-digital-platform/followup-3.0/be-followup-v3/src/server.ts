import http from "node:http";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ENV, isProductionLike } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { ensureCoreIndexes } from "./config/ensureIndexes.js";
import { v1Router } from "./routes/v1.js";
import { platformRoutes } from "./routes/v1/platform.routes.js";
import { customerPortalPublicRoutes, customerPortalRoutes } from "./routes/v1/customer-portal.routes.js";
import { ensureDefaultRoleDefinitions } from "./core/rbac/roleDefinitions.service.js";
import { logger } from "./observability/logger.js";
import { initOtel, shutdownOtel } from "./observability/otel.js";
import { requestContextMiddleware } from "./routes/requestContextMiddleware.js";
import { requireAuth } from "./routes/authMiddleware.js";

/** I job schedulati (comms, marketing, retention, MLS) sono eseguiti dal worker: node dist/job-runner.js */

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
  ENV.CORS_ORIGINS_LIST.forEach((origin) => add(origin));
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

  const app = express();
  if (isProductionLike()) {
    app.set("trust proxy", 1);
  }
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(requestContextMiddleware);
  app.use(
    cors({
      origin: buildCorsOriginChecker(),
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/v1/portal", customerPortalPublicRoutes);
  app.use("/v1/portal", requireAuth, customerPortalRoutes);
  app.use("/v1/platform", platformRoutes);
  app.use("/v1", v1Router);

  const server = http.createServer(
    { maxHeaderSize: 32 * 1024 },
    app
  );
  server.listen(ENV.PORT, () => {
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
