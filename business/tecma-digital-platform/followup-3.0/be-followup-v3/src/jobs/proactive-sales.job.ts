import { ENV } from "../config/env.js";
import { runProactiveSalesScanAllEnabledWorkspaces } from "../core/zeus/proactive-engine.service.js";
import { logger } from "../observability/logger.js";

/** Eseguito dal job-runner se `PROACTIVE_SALES_JOB_ENABLED=true`. */
export async function runProactiveSalesScheduledJob(): Promise<void> {
  if (!ENV.PROACTIVE_SALES_JOB_ENABLED) return;
  await runProactiveSalesScanAllEnabledWorkspaces();
  logger.info("[proactive-sales] scheduled batch completed");
}
