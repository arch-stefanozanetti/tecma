/**
 * Worker entrypoint: esegue i job schedulati (comms, marketing, retention, MLS, GDPR erasure, export audit se configurato).
 * Avviare come processo separato (es. Background Worker su Render) per evitare
 * duplicazione e race quando si scala orizzontalmente l'API.
 *
 * Avvio: node dist/job-runner.js
 * Variabile d'ambiente: RUN_SCHEDULED_JOBS non usata qui (questo file è solo worker).
 */
import { connectDb } from "./config/db.js";
import { ensureCoreIndexes } from "./config/ensureIndexes.js";
import { runDueScheduled } from "./core/communications/scheduled-communications.service.js";
import { runDueMarketingAutomations } from "./core/automations/marketing-automation.service.js";
import { runPrivacyRetentionJob } from "./core/privacy/privacy.service.js";
import { processPendingGdprErasureBatch } from "./core/gdpr/gdpr-erasure.worker.js";
import { runSecurityAuditExportJob } from "./core/compliance/security-audit-export.job.js";
import { runGlobalMlsReconciliation } from "./core/connectors/mls-feed.service.js";
import { createOperationalAlert } from "./core/ops/operational-alerts.service.js";
import { ensureDefaultRoleDefinitions } from "./core/rbac/roleDefinitions.service.js";
import { logger } from "./observability/logger.js";
import { initOtel, shutdownOtel } from "./observability/otel.js";

const SCHEDULED_COMMS_INTERVAL_MS = 2 * 60 * 1000;
const MARKETING_AUTOMATION_INTERVAL_MS = 2 * 60 * 1000;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MLS_RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000;
const GDPR_ERASURE_INTERVAL_MS = 15 * 60 * 1000;
const SECURITY_AUDIT_EXPORT_INTERVAL_MS = 24 * 60 * 60 * 1000;

const run = async () => {
  await initOtel();
  await connectDb();
  await ensureCoreIndexes().catch((err) => {
    logger.error({ err }, "[job-runner] ensureCoreIndexes failed");
    throw err;
  });
  await ensureDefaultRoleDefinitions().catch((err) => {
    logger.error({ err }, "[job-runner] ensureDefaultRoleDefinitions failed");
  });

  logger.info(
    "job-runner started (scheduled comms, marketing, retention, MLS, GDPR erasure, security audit export if configured)"
  );

  void runSecurityAuditExportJob().catch((err) => {
    logger.error({ err }, "[security-audit] initial export job failed");
  });

  const t1 = setInterval(() => {
    runDueScheduled().catch((err) => {
      logger.error({ err }, "[scheduled-communications] runDueScheduled failed");
    });
  }, SCHEDULED_COMMS_INTERVAL_MS);

  const t2 = setInterval(() => {
    runDueMarketingAutomations().catch((err) => {
      logger.error({ err }, "[marketing-automation] runDueMarketingAutomations failed");
      void createOperationalAlert({
        workspaceId: "global",
        source: "marketing.runner",
        severity: "critical",
        title: "Marketing automation runner failed",
        message: err instanceof Error ? err.message : "unknown error",
      });
    });
  }, MARKETING_AUTOMATION_INTERVAL_MS);

  const t3 = setInterval(() => {
    runPrivacyRetentionJob({ olderThanDays: 365 }).catch((err) => {
      logger.error({ err }, "[privacy] runPrivacyRetentionJob failed");
      void createOperationalAlert({
        workspaceId: "global",
        source: "privacy.retention",
        severity: "critical",
        title: "Privacy retention job failed",
        message: err instanceof Error ? err.message : "unknown error",
      });
    });
  }, RETENTION_INTERVAL_MS);

  const t4 = setInterval(() => {
    runGlobalMlsReconciliation().catch((err) => {
      logger.error({ err }, "[mls] runGlobalMlsReconciliation failed");
      void createOperationalAlert({
        workspaceId: "global",
        source: "mls.reconciliation",
        severity: "critical",
        title: "MLS reconciliation runner failed",
        message: err instanceof Error ? err.message : "unknown error",
      });
    });
  }, MLS_RECONCILIATION_INTERVAL_MS);

  const t5 = setInterval(() => {
    processPendingGdprErasureBatch({ limit: 10 }).catch((err) => {
      logger.error({ err }, "[gdpr-erasure] processPendingGdprErasureBatch failed");
      void createOperationalAlert({
        workspaceId: "global",
        source: "gdpr.erasure",
        severity: "warning",
        title: "GDPR erasure batch failed",
        message: err instanceof Error ? err.message : "unknown error",
      });
    });
  }, GDPR_ERASURE_INTERVAL_MS);

  const t6 = setInterval(() => {
    runSecurityAuditExportJob().catch((err) => {
      logger.error({ err }, "[security-audit] scheduled export failed");
      void createOperationalAlert({
        workspaceId: "global",
        source: "security.audit.export",
        severity: "warning",
        title: "Security audit JSONL export failed",
        message: err instanceof Error ? err.message : "unknown error",
      });
    });
  }, SECURITY_AUDIT_EXPORT_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "job-runner shutting down");
    clearInterval(t1);
    clearInterval(t2);
    clearInterval(t3);
    clearInterval(t4);
    clearInterval(t5);
    clearInterval(t6);
    await shutdownOtel().catch((err) => logger.error({ err }, "OpenTelemetry shutdown failed"));
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

run().catch((error) => {
  logger.fatal({ err: error }, "job-runner failed to start");
  process.exit(1);
});
