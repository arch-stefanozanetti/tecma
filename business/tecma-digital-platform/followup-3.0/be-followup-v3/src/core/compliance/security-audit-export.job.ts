import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ObjectId } from "mongodb";
import { ENV } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import { exportSecurityAuditJsonlIncremental } from "./security-audit.service.js";

const STATE_FILE = ".security-audit-export-state.json";

interface ExportState {
  lastExportedObjectId?: string;
}

/**
 * Scrive JSONL incrementale (watermark su disco) se `SECURITY_AUDIT_EXPORT_DIR` è valorizzata.
 * Stato: `.security-audit-export-state.json` nella stessa directory (`lastExportedObjectId`).
 */
export async function runSecurityAuditExportJob(): Promise<void> {
  const dir = (ENV.SECURITY_AUDIT_EXPORT_DIR ?? "").trim();
  if (!dir) return;

  await mkdir(dir, { recursive: true });

  let state: ExportState = {};
  try {
    const raw = await readFile(join(dir, STATE_FILE), "utf8");
    state = JSON.parse(raw) as ExportState;
  } catch {
    state = {};
  }

  const afterRaw = state.lastExportedObjectId?.trim();
  let afterObjectId: string | undefined;
  if (afterRaw) {
    if (ObjectId.isValid(afterRaw)) afterObjectId = afterRaw;
    else logger.warn({ afterRaw }, "[security-audit] invalid export cursor, re-baselining first batch");
  }

  const { jsonl, maxObjectIdInBatch } = await exportSecurityAuditJsonlIncremental({
    ...(afterObjectId !== undefined ? { afterObjectId } : {}),
    maxDocs: 25_000
  });

  const trimmed = jsonl.trim();
  if (!trimmed) {
    logger.info("[security-audit] scheduled export skipped (no new events)");
    return;
  }

  const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `security-audit-${safeTs}.jsonl`;
  const filePath = join(dir, fileName);
  const body = trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
  await writeFile(filePath, body, "utf8");

  if (maxObjectIdInBatch) {
    const nextState: ExportState = { lastExportedObjectId: maxObjectIdInBatch };
    await writeFile(join(dir, STATE_FILE), `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  }

  logger.info(
    { path: filePath, lines: trimmed.split("\n").filter(Boolean).length, cursor: maxObjectIdInBatch },
    "[security-audit] scheduled incremental export written"
  );
}
