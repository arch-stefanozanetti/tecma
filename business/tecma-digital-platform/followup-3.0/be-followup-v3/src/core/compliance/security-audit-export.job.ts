import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ENV } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import { exportSecurityAuditJsonl } from "./security-audit.service.js";

/**
 * Scrive un file JSONL (ultimi N eventi, più recenti prima) se `SECURITY_AUDIT_EXPORT_DIR` è valorizzata.
 * Pensato per job-runner / ops (SIEM, volume montato, object storage sync esterno).
 */
export async function runSecurityAuditExportJob(): Promise<void> {
  const dir = (ENV.SECURITY_AUDIT_EXPORT_DIR ?? "").trim();
  if (!dir) return;

  const jsonl = await exportSecurityAuditJsonl({
    maxDocs: 25_000,
    sortOrder: "desc"
  });
  const trimmed = jsonl.trim();
  if (!trimmed) {
    logger.info("[security-audit] scheduled export skipped (no events)");
    return;
  }
  const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `security-audit-${safeTs}.jsonl`;
  const filePath = join(dir, fileName);
  await mkdir(dir, { recursive: true });
  const body = trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
  await writeFile(filePath, body, "utf8");
  logger.info(
    { path: filePath, lines: trimmed.split("\n").filter(Boolean).length },
    "[security-audit] scheduled export written"
  );
}
