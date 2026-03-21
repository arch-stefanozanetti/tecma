import { test, expect, type Page, type Route } from "@playwright/test";

const PROJECT_SCOPE = {
  email: "e2e@test.local",
  role: "admin",
  isAdmin: true,
  workspaceId: "dev-1",
  apiEnvironment: "dev-1",
  projects: [{ id: "p1", name: "Progetto 1", displayName: "Progetto 1" }],
  selectedProjectIds: ["p1"],
};

const mockClient = {
  _id: "c1",
  projectId: "p1",
  firstName: "Mario",
  lastName: "Rossi",
  fullName: "Mario Rossi",
  email: "mario.rossi@example.com",
  phone: "+39 333 000 111",
  status: "lead",
  createdAt: "2026-01-10T09:00:00.000Z",
  updatedAt: "2026-01-10T09:00:00.000Z",
  city: "Milano",
};

const mockApartment = {
  _id: "a1",
  workspaceId: "dev-1",
  projectId: "p1",
  code: "A-101",
  name: "Bilocale 101",
  status: "AVAILABLE",
  mode: "SELL",
  surfaceMq: 78,
  normalizedPrice: { amount: 245000, currency: "EUR", mode: "SELL", display: "€245.000" },
  updatedAt: "2026-01-12T10:00:00.000Z",
  createdAt: "2026-01-12T10:00:00.000Z",
};

const mockRequest = {
  _id: "r1",
  workspaceId: "dev-1",
  projectId: "p1",
  clientId: "c1",
  clientName: "Mario Rossi",
  apartmentId: "a1",
  apartmentCode: "A-101",
  type: "sell",
  status: "new",
  createdAt: "2026-01-12T10:00:00.000Z",
  updatedAt: "2026-01-12T10:00:00.000Z",
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
    window.sessionStorage.setItem("followup3.accessToken", "e2e-access-token");
    window.sessionStorage.setItem("followup3.refreshToken", "e2e-refresh-token");
    window.sessionStorage.setItem("followup3.permLastSync", String(Date.now()));
    window.localStorage.setItem("followup3.projectScope", JSON.stringify(scope));
  }, PROJECT_SCOPE);
};

const mockCoreApi = async (page: Page) => {
  await page.route("**/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path === "/v1/workspaces" && method === "GET") {
      return fulfillJson(route, [{ _id: "dev-1", name: "dev-1", displayName: "Dev 1", features: ["clients", "apartments", "requests"] }]);
    }

    if (path === "/v1/notifications" && method === "GET") {
      return fulfillJson(route, { data: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    }

    if (path === "/v1/workspaces/dev-1/additional-infos" && method === "GET") {
      return fulfillJson(route, { data: [] });
    }

    if (path === "/v1/clients/query" && method === "POST") {
      return fulfillJson(route, {
        data: [mockClient],
        pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 },
      });
    }

    if (path === "/v1/apartments/query" && method === "POST") {
      return fulfillJson(route, {
        data: [mockApartment],
        pagination: { page: 1, perPage: 10, total: 1, totalPages: 1 },
      });
    }

    if (path === "/v1/requests/query" && method === "POST") {
      return fulfillJson(route, {
        data: [mockRequest],
        pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });
    }

    if (path === "/v1/requests/actions" && method === "GET") {
      return fulfillJson(route, { actions: [] });
    }

    if (path === "/v1/session/preferences" && method === "POST") {
      return fulfillJson(route, {
        found: true,
        email: PROJECT_SCOPE.email,
        workspaceId: PROJECT_SCOPE.workspaceId,
        selectedProjectIds: PROJECT_SCOPE.selectedProjectIds,
      });
    }

    if (path.startsWith("/v1/requests/") && path.endsWith("/transitions") && method === "GET") {
      return fulfillJson(route, { transitions: [] });
    }

    if (path.startsWith("/v1/requests/") && method === "GET") {
      return fulfillJson(route, { request: mockRequest });
    }

    return fulfillJson(route, { ok: true });
  });
};

test.beforeEach(async ({ page }) => {
  await installSession(page);
  await mockCoreApi(page);
});

test.describe("Core journeys", () => {
  test("clients journey: pagina clienti caricata con dati", async ({ page }) => {
    await page.goto("/clients");

    await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();
    const row = page.locator("main table tbody tr").filter({ hasText: "mario.rossi@example.com" }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
    await expect(row.getByText("mario.rossi@example.com")).toBeVisible();
  });

  test("apartments journey: pagina appartamenti caricata con dati", async ({ page }) => {
    await page.goto("/apartments");

    await expect(page.getByRole("heading", { name: "Appartamenti", exact: true })).toBeVisible();
    const row = page.locator("main table tbody tr").filter({ hasText: "A-101" }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("€245.000")).toBeVisible();
  });

  test("requests journey: lista e kanban stabili", async ({ page }) => {
    await page.goto("/requests");

    await expect(page.getByRole("heading", { name: "Trattative" })).toBeVisible();
    await expect(page.getByText("Mario Rossi")).toBeVisible();

    await page.getByRole("tab", { name: "Kanban" }).click();
    await expect(page.getByRole("tab", { name: "Kanban" })).toBeVisible();
    await expect(page.getByText("Nuova", { exact: true })).toBeVisible();
    await expect(page.getByText("Apt: A-101")).toBeVisible();
  });
});
