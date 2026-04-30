import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const PROJECT_SCOPE = {
  email: "integrations-e2e@test.local",
  role: "admin",
  isAdmin: true,
  workspaceId: "dev-1",
  apiEnvironment: "dev-1",
  projects: [{ id: "p1", name: "Progetto 1", displayName: "Progetto 1" }],
  selectedProjectIds: ["p1"]
};

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
};

const installSession = async (page: Page) => {
  await page.addInitScript((scope) => {
    window.sessionStorage.setItem("followup3.accessToken", "integrations-access-token");
    window.sessionStorage.setItem("followup3.refreshToken", "integrations-refresh-token");
    window.localStorage.setItem("followup3.projectScope", JSON.stringify(scope));
    const openSpy: Array<string> = [];
    (window as unknown as { __openedUrls?: string[] }).__openedUrls = openSpy;
    window.open = ((url?: string | URL | undefined) => {
      if (url) openSpy.push(String(url));
      return null;
    }) as typeof window.open;
  }, PROJECT_SCOPE);
};

const mockIntegrationsApi = async (context: BrowserContext) => {
  await context.route("**/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();

    if (path === "/v1/auth/me" && method === "GET") {
      return fulfillJson(route, {
        user: { _id: "u-int", email: PROJECT_SCOPE.email, role: "admin", isAdmin: true }
      });
    }
    if (path === "/v1/auth/refresh" && method === "POST") {
      return fulfillJson(route, { accessToken: "integrations-access-token", refreshToken: "integrations-refresh-token" });
    }
    if (path === "/v1/workspaces" && method === "GET") {
      return fulfillJson(route, [{ _id: "dev-1", name: "Dev 1", features: ["integrations"] }]);
    }
    if (path === "/v1/session/preferences" && method === "POST") {
      return fulfillJson(route, {
        found: true,
        email: PROJECT_SCOPE.email,
        workspaceId: PROJECT_SCOPE.workspaceId,
        selectedProjectIds: PROJECT_SCOPE.selectedProjectIds
      });
    }
    if (path === "/v1/workspaces/dev-1/projects" && method === "GET") {
      return fulfillJson(route, { data: [{ projectId: "p1" }] });
    }
    if (path === "/v1/workspaces/dev-1/entitlements" && method === "GET") {
      return fulfillJson(route, { data: [] });
    }
    if (path === "/v1/connectors/outlook/status" && method === "GET") {
      return fulfillJson(route, { connected: false });
    }
    if (path.includes("/connectors/marketing-google/oauth-url") && method === "GET") {
      return fulfillJson(route, { url: "https://accounts.google.test/oauth" });
    }
    if (path.includes("/connectors/marketing-meta/oauth-url") && method === "GET") {
      return fulfillJson(route, { url: "https://facebook.test/oauth" });
    }
    if (path.includes("/connectors/") && path.endsWith("/verify") && method === "GET") {
      return fulfillJson(route, {
        verify: { connected: false, configured: false, providerReachable: false, authValid: false, reasonCode: "CONFIG_MISSING" }
      });
    }
    if (path.includes("/connectors/") && path.endsWith("/config") && method === "GET") {
      return fulfillJson(route, { config: null });
    }
    if (path.includes("/webhook-configs") && method === "GET") {
      return fulfillJson(route, { data: [] });
    }
    if (path.includes("/webhook-configs") && method === "POST") {
      return fulfillJson(route, { config: { _id: "wh1", url: "https://hook.example.test", events: ["request.updated"], enabled: true } });
    }
    return fulfillJson(route, { ok: true });
  });
};

test.beforeEach(async ({ page, context }) => {
  await installSession(page);
  await mockIntegrationsApi(context);
});

test("integrazioni connettori: auto-open drawer Twilio e CTA apre provider", async ({ page }) => {
  await page.goto("/integrations?tab=connettori&connector=connector_twilio");
  await expect(page.getByText("Twilio", { exact: false }).first()).toBeVisible({ timeout: 15000 });
  const connectNow = page.getByRole("button", { name: "Connetti ora" }).first();
  await expect(connectNow).toBeVisible({ timeout: 15000 });
  await connectNow.click();
  const opened = await page.evaluate(() => (window as unknown as { __openedUrls?: string[] }).__openedUrls ?? []);
  expect(opened.length).toBeGreaterThan(0);
});

test("integrazioni webhook: tab renderizza CTA nuova configurazione", async ({ page }) => {
  await page.goto("/integrations?tab=webhook");
  await expect(page.getByRole("button", { name: /Aggiungi webhook|Nuovo webhook/i }).first()).toBeVisible({ timeout: 15000 });
});
