import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const PROJECT_SCOPE = {
  email: "detail-e2e@test.local",
  role: "admin",
  isAdmin: true,
  workspaceId: "dev-1",
  apiEnvironment: "dev-1",
  projects: [{ id: "p1", name: "Progetto 1", displayName: "Progetto 1" }],
  selectedProjectIds: ["p1"],
};

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
};

const installSession = async (page: Page) => {
  await page.addInitScript((scope) => {
    window.sessionStorage.setItem("followup3.accessToken", "detail-access-token");
    window.sessionStorage.setItem("followup3.refreshToken", "detail-refresh-token");
    window.localStorage.setItem("followup3.projectScope", JSON.stringify(scope));
  }, PROJECT_SCOPE);
};

const mockDetailApi = async (context: BrowserContext) => {
  await context.route("**/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    const workspaceProjectsMatch = path.match(/^\/v1\/workspaces\/([^/]+)\/projects$/);
    const workspaceMatch = path.match(/^\/v1\/workspaces\/([^/]+)$/);
    const clientMatch = path.match(/^\/v1\/clients\/([^/]+)$/);
    const apartmentMatch = path.match(/^\/v1\/apartments\/([^/]+)$/);

    if (path === "/v1/workspaces" && method === "GET") {
      return fulfillJson(route, [{ _id: "dev-1", name: "Dev 1", features: ["clients", "apartments", "requests", "calendar"] }]);
    }
    if (path === "/v1/session/preferences" && method === "POST") {
      return fulfillJson(route, {
        found: true,
        email: PROJECT_SCOPE.email,
        workspaceId: PROJECT_SCOPE.workspaceId,
        selectedProjectIds: PROJECT_SCOPE.selectedProjectIds,
      });
    }
    if (path === "/v1/auth/me" && method === "GET") {
      return fulfillJson(route, {
        user: {
          _id: "u-detail",
          email: PROJECT_SCOPE.email,
          role: "admin",
          isAdmin: true,
        },
      });
    }
    if (path === "/v1/auth/refresh" && method === "POST") {
      return fulfillJson(route, {
        accessToken: "detail-access-token",
        refreshToken: "detail-refresh-token",
      });
    }
    if (workspaceProjectsMatch && method === "GET") {
      return fulfillJson(route, { data: [{ projectId: "p1" }] });
    }
    if (workspaceMatch && method === "GET") {
      return fulfillJson(route, { workspace: { _id: workspaceMatch[1], features: ["clients", "apartments", "calendar"] } });
    }
    if (path === "/v1/notifications" && method === "GET") {
      return fulfillJson(route, { data: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    }
    if (path === "/v1/workspaces/dev-1/additional-infos" && method === "GET") {
      return fulfillJson(route, { data: [] });
    }
    if (clientMatch && method === "GET") {
      return fulfillJson(route, {
        client: {
          _id: clientMatch[1],
          workspaceId: "dev-1",
          projectId: "p1",
          firstName: "Mario",
          lastName: "Rossi",
          fullName: "Mario Rossi",
          email: "mario@example.com",
          status: "lead",
          updatedAt: "2026-03-19T10:00:00.000Z",
        },
      });
    }
    if (apartmentMatch && method === "GET") {
      return fulfillJson(route, {
        apartment: {
          _id: apartmentMatch[1],
          workspaceId: "dev-1",
          projectId: "p1",
          code: "APT-101",
          name: "Bilocale 101",
          status: "AVAILABLE",
          mode: "SELL",
          updatedAt: "2026-03-19T10:00:00.000Z",
        },
      });
    }
    if (path === "/v1/requests/query" && method === "POST") {
      return fulfillJson(route, { data: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 1 } });
    }
    if (path === "/v1/workspaces/dev-1/assignments/query" && method === "POST") return fulfillJson(route, { data: [] });
    if (path === "/v1/workspaces/dev-1/users" && method === "GET") return fulfillJson(route, { data: [] });
    if (path === "/v1/audit/query" && method === "POST") return fulfillJson(route, { data: [] });
    if (path === "/v1/matching/clients/c1/candidates" && method === "GET") return fulfillJson(route, { data: [] });
    if (path === "/v1/matching/apartments/a1/candidates" && method === "GET") return fulfillJson(route, { data: [] });
    if (path === "/v1/calendar/events/query" && method === "POST") return fulfillJson(route, { data: [] });
    if (path === "/v1/apartments/a1/prices" && method === "GET") return fulfillJson(route, { current: null, salePrices: [], monthlyRents: [] });
    if (path === "/v1/apartments/a1/inventory" && method === "GET") return fulfillJson(route, { inventory: null, lock: null, effectiveStatus: "available" });
    if (path === "/v1/workflows/query" && method === "POST") return fulfillJson(route, { data: [] });
    if (path === "/v1/auth/login" && method === "POST") {
      return fulfillJson(route, {
        accessToken: "detail-access-token",
        refreshToken: "detail-refresh-token",
        user: { _id: "u-detail", email: PROJECT_SCOPE.email, role: "admin", isAdmin: true },
      });
    }

    return fulfillJson(route, { ok: true });
  });
};

test.beforeEach(async ({ page, context }) => {
  await installSession(page);
  await mockDetailApi(context);
});

test("client detail journey: renders and opens edit drawer", async ({ page }) => {
  await page.goto("/clients/c1");
  await expect(page.getByText("Caricamento...")).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Modifica" }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Modifica" }).first().click();
  await expect(page.getByText("Modifica cliente")).toBeVisible({ timeout: 15000 });
});

test("apartment detail journey: renders and opens edit drawer", async ({ page }) => {
  await page.goto("/apartments/a1");
  await expect(page.getByText("Caricamento...")).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Modifica" }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Modifica" }).first().click();
  await expect(page.getByText("Modifica appartamento")).toBeVisible({ timeout: 15000 });
});
