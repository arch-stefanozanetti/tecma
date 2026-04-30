import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkPanelCompliance } from "./panel-guard.mjs";

describe("panel-guard", () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fixturesRoot = path.resolve(currentDir, "__fixtures__/panels");

  it("accetta fixture positive", () => {
    const result = checkPanelCompliance(path.join(fixturesRoot, "positive"));
    expect(result.violations).toHaveLength(0);
  });

  it("rileva import radix fuori UI", () => {
    const result = checkPanelCompliance(path.join(fixturesRoot, "negative"));
    expect(result.violations.some((v) => v.message.includes("@radix-ui/react-dialog"))).toBe(true);
  });

  it("accetta i file target migrati nel codice reale", () => {
    const srcRoot = path.resolve(currentDir, "../src");
    const result = checkPanelCompliance(srcRoot);

    const targetFiles = [
      path.join("core", "calendar", "CalendarPage.tsx"),
      path.join("core", "calendar", "CalendarEventFormDrawer.tsx"),
      path.join("core", "product-discovery", "ProductDiscoveryPage.tsx"),
      path.join("core", "shared", "Inbox.tsx"),
    ];

    const targetViolations = result.violations.filter((v) =>
      targetFiles.some((target) => v.filePath.endsWith(target))
    );

    expect(targetViolations).toHaveLength(0);
  });
});
