import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility (WCAG): login page.
 * Usa axe-core per rilevare violazioni; test fallisce se ci sono violation con impact critical/serious.
 */
test.describe("A11y — login page", () => {
  test("login page has no critical or serious accessibility violations", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Accedi/i })).toBeVisible({
      timeout: 8000,
    });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      criticalOrSerious,
      `A11y violations (critical/serious): ${JSON.stringify(criticalOrSerious, null, 2)}`
    ).toEqual([]);
  });
});
