import cors from "cors";
import express from "express";
import { ENV, isProductionLike } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { v1Router } from "./routes/v1.js";
import { runDueScheduled } from "./core/communications/scheduled-communications.service.js";
import { ensureDefaultRoleDefinitions } from "./core/rbac/roleDefinitions.service.js";

const SCHEDULED_COMMS_INTERVAL_MS = 2 * 60 * 1000;

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
  await connectDb();
  await ensureDefaultRoleDefinitions().catch((err) => {
    console.error("[rbac] ensureDefaultRoleDefinitions:", err);
  });

  setInterval(() => {
    runDueScheduled().catch((err) => {
      console.error("[scheduled-communications] runDueScheduled failed:", err);
    });
  }, SCHEDULED_COMMS_INTERVAL_MS);

  const app = express();
  app.use(
    cors({
      origin: buildCorsOriginChecker(),
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/v1", v1Router);

  app.listen(ENV.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`be-followup-v3 listening on :${ENV.PORT}`);
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start be-followup-v3", error);
  process.exit(1);
});
