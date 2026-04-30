import { test, expect, type Page } from "@playwright/test";

const WS_A = "ws-e2e-a";
const WS_B = "ws-e2e-b";

type ProjectScope = {
  email: string;
  role: string;
  isAdmin: boolean;
  isTecmaAdmin?: boolean;
  workspaceId: string;
  apiEnvironment: string;
  projects: { id: string; name: string; displayName: string }[];
  selectedProjectIds: string[];
};

function baseScope(isTecmaAdmin: boolean): ProjectScope {
  return {
    email: "e2e-entitlements@test.local",
    role: "admin",
    isAdmin: true,
    isTecmaAdmin,
    workspaceId: WS_A,
    apiEnvironment: "dev-1",
    projects: [{ id: "p1", name: "Progetto 1", displayName: "Progetto 1" }],
    selectedProjectIds: ["p1"],
  };
}

const installSession = async (page: Page, scope: ProjectScope) => {
  await page.addInitScript((s) => {
    window.sessionStorage.setItem("followup3.accessToken", "e2e-entitlements-access");
    window.sessionStorage.setItem("followup3.refreshToken", "e2e-entitlements-refresh");
    /** Evita che App.tsx sovrascriva `isTecmaAdmin` con GET /auth/me dopo refresh (sync permessi). */
    window.sessionStorage.setItem("followup3.permLastSync", String(Date.now()));
    window.localStorage.setItem("followup3.projectScope", JSON.stringify(s));
  }, scope);
};

/** Risposta elenco effettivo entitlement (allineata a `WorkspaceEntitlementEffectiveRow`). */
const entitlementsBody = () => ({
  data: [
    { feature: "publicApi", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
    { feature: "twilio", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
    { feature: "mailchimp", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
    { feature: "activecampaign", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
    { feature: "aiApprovals", entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
    { feature: "reports", entitled: true, recordedStatus: "active", implicit: false, recordedNotes: null },
    { feature: "integrations", entitled: true, recordedStatus: "active", implicit: false, recordedNotes: null },
  ],
});

async function mockEntitlementsApi(page: Page) {
  await page.route("**/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === `/v1/workspaces/${WS_A}/projects` && method === "GET") return fulfill({ data: [{ projectId: "p1" }] });
    if (path === `/v1/workspaces/${WS_B}/projects` && method === "GET") return fulfill({ data: [{ projectId: "p1" }] });
    if (path === `/v1/workspaces/${WS_A}` && method === "GET") {
      return fulfill({ workspace: { _id: WS_A, name: "Workspace Alfa", features: ["integrations", "reports", "requests"] } });
    }
    if (path === `/v1/workspaces/${WS_B}` && method === "GET") {
      return fulfill({ workspace: { _id: WS_B, name: "Workspace Beta", features: ["integrations", "reports"] } });
    }
    if (path === "/v1/workspaces" && method === "GET") {
      return fulfill([
        { _id: WS_A, name: "Workspace Alfa", features: [] },
        { _id: WS_B, name: "Workspace Beta", features: [] },
      ]);
    }
    if (path === "/v1/notifications" && method === "GET") {
      return fulfill({ data: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    }
    if (path === "/v1/session/preferences" && method === "POST") {
      return fulfill({
        found: true,
        email: "e2e-entitlements@test.local",
        workspaceId: WS_A,
        selectedProjectIds: ["p1"],
      });
    }
    if (
      (path === `/v1/workspaces/${WS_A}/entitlements` || path === `/v1/workspaces/${WS_B}/entitlements`) &&
      method === "GET"
    ) {
      return fulfill(entitlementsBody());
    }

    return fulfill({ ok: true });
  });
}

test.describe("Entitlement — console Tecma (mock API)", () => {
  test("Tecma admin: /tecma/entitlements mostra tabella e ricarica entitlement dopo cambio workspace", async ({ page }) => {
    await installSession(page, baseScope(true));
    await mockEntitlementsApi(page);

    await page.goto("/tecma/entitlements");

    await expect(page.getByRole("heading", { level: 1, name: /Entitlement workspace/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("columnheader", { name: "Modulo" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Reportistica/i })).toBeVisible();

    const entitlementsBeta = page.waitForResponse(
      (res) =>
        res.url().includes(`/workspaces/${WS_B}/entitlements`) &&
        res.request().method() === "GET" &&
        res.status() === 200
    );
    await page.getByRole("combobox").filter({ hasText: /Workspace Alfa/i }).click();
    await page.getByRole("option", { name: /Workspace Beta/i }).click();
    await entitlementsBeta;
    await expect(page.getByRole("row", { name: /Reportistica/i })).toBeVisible();
  });

  test("Utente non Tecma: accesso negato su /tecma/entitlements", async ({ page }) => {
    await installSession(page, baseScope(false));
    await mockEntitlementsApi(page);
    await page.goto("/tecma/entitlements");

    await expect(page.getByRole("heading", { level: 1, name: /Accesso negato/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Solo amministratori Tecma/i)).toBeVisible();
  });
});

test.describe("Entitlement — smoke API (backend reale, opzionale)", () => {
  test("POST /v1/reports/:type → 403 FEATURE_NOT_ENTITLED quando configurato in env", async ({ request }) => {
    test.skip(
      !process.env.E2E_API_BASE_URL ||
        !process.env.E2E_JWT ||
        !process.env.E2E_ENTITLEMENTS_TEST_WORKSPACE_ID?.trim(),
      "Imposta E2E_API_BASE_URL, E2E_JWT e E2E_ENTITLEMENTS_TEST_WORKSPACE_ID"
    );
    const base = process.env.E2E_API_BASE_URL!.replace(/\/$/, "");
    const jwt = process.env.E2E_JWT!;
    const workspaceId = process.env.E2E_ENTITLEMENTS_TEST_WORKSPACE_ID!.trim();

    const res = await request.post(`${base}/reports/pipeline`, {
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      data: { workspaceId, projectIds: ["p1"] },
    });
    expect(res.status(), await res.text()).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("FEATURE_NOT_ENTITLED");
  });
});
