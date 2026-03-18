#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SRC_ROOT = path.join(__dirname, "..", "src");
const UI_DIR_SEGMENT = `${path.sep}src${path.sep}components${path.sep}ui${path.sep}`;

export const operationalFiles = [
  path.join("core", "calendar", "CalendarPage.tsx"),
  path.join("core", "calendar", "CalendarEventFormDrawer.tsx"),
  path.join("core", "product-discovery", "ProductDiscoveryPage.tsx"),
];

export const previewFiles = [
  path.join("core", "shared", "Inbox.tsx"),
];

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      files.push(...walkFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
    files.push(full);
  }
  return files;
}

function addViolation(violations, filePath, message, line) {
  violations.push({
    filePath,
    message,
    line,
  });
}

function findLineNumber(content, pattern) {
  const idx = content.search(pattern);
  if (idx < 0) return 1;
  return content.slice(0, idx).split("\n").length;
}

function validateFile(filePath, content, srcRoot) {
  const violations = [];
  const isUiFile = filePath.includes(UI_DIR_SEGMENT);
  const relative = path.relative(srcRoot, filePath);
  const usesSheetLowLevel =
    /<\s*Sheet(Content|Header|Title|Footer|Body)?\b/.test(content) ||
    /from\s+["'][^"']*\/sheet["']/.test(content);
  const usesDrawerLowLevel =
    /<\s*Drawer(Content|Header|Title|Footer|Body|Close|Trigger)?\b/.test(content) ||
    /from\s+["'][^"']*\/drawer["']/.test(content);

  if (!isUiFile && /from\s+["']@radix-ui\/react-dialog["']/.test(content)) {
    addViolation(
      violations,
      filePath,
      "Import diretto di @radix-ui/react-dialog fuori da src/components/ui.",
      findLineNumber(content, /from\s+["']@radix-ui\/react-dialog["']/)
    );
  }

  if (operationalFiles.some((target) => relative.endsWith(target))) {
    if (usesSheetLowLevel) {
      addViolation(
        violations,
        filePath,
        "Feature operational non puo usare Sheet: usare SidePanel variant=\"operational\".",
        findLineNumber(content, /<\s*Sheet(Content|Header|Title|Footer|Body)?\b|from\s+["'][^"']*\/sheet["']/)
      );
    }
    if (usesDrawerLowLevel) {
      addViolation(
        violations,
        filePath,
        "Feature operational non puo usare Drawer low-level: usare SidePanel variant=\"operational\".",
        findLineNumber(content, /<\s*Drawer(Content|Header|Title|Footer|Body|Close|Trigger)?\b|from\s+["'][^"']*\/drawer["']/)
      );
    }
    if (!/\bSidePanel\b/.test(content)) {
      addViolation(
        violations,
        filePath,
        "Feature operational deve usare SidePanel.",
        1
      );
    }
  }

  if (previewFiles.some((target) => relative.endsWith(target))) {
    if (usesDrawerLowLevel) {
      addViolation(
        violations,
        filePath,
        "Feature preview/navigation non puo usare Drawer: usare SidePanel variant=\"preview\" o \"navigation\".",
        findLineNumber(content, /<\s*Drawer(Content|Header|Title|Footer|Body|Close|Trigger)?\b|from\s+["'][^"']*\/drawer["']/)
      );
    }
    if (/\bSidePanel\b/.test(content) && !/variant=\"(preview|navigation)\"/.test(content)) {
      addViolation(
        violations,
        filePath,
        "Feature preview/navigation deve usare SidePanel variant=\"preview\" o \"navigation\".",
        findLineNumber(content, /\bSidePanel\b/)
      );
    }
  }

  return violations;
}

export function checkPanelCompliance(srcRoot = DEFAULT_SRC_ROOT) {
  const files = walkFiles(srcRoot);
  const violations = files.flatMap((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    return validateFile(filePath, content, srcRoot);
  });

  return {
    srcRoot,
    filesChecked: files.length,
    violations,
  };
}

function runCli() {
  const srcRoot = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_SRC_ROOT;

  const result = checkPanelCompliance(srcRoot);
  if (result.violations.length === 0) {
    console.log(`Panel guard: OK (${result.filesChecked} file controllati)`);
    return;
  }

  console.error(`Panel guard: FALLITO (${result.violations.length} violazioni)`);
  for (const violation of result.violations) {
    const relative = path.relative(process.cwd(), violation.filePath);
    console.error(`- ${relative}:${violation.line} ${violation.message}`);
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
