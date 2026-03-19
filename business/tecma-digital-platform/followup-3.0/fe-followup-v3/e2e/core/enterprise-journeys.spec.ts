import { test, expect, type Page, type Route } from "@playwright/test";

const PROJECT_SCOPE = {
  email: "enterprise@test.local",
  role: "admin",
  isAdmin: true,
  workspaceId: "dev-1",
  apiEnvironment: "dev-1",
  projects: [{ id: "p1", name: "Progetto 1", displayName: "Progetto 1" }],
  selectedProjectIds: ["p1"],
};

const installSession = async (page: Page) => {
  await page.addInitScript((scope) => {
    window.sessionStorage.setItem("followup3.accessToken", "enterprise-access-token");
    window.sessionStorage.setItem("followup3.refreshToken", "enterprise-refresh-token");
    window.localStorage.setItem("followup3.projectScope", JSON.stringify(scope));
  }, PROJECT_SCOPE);
};

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
};

const mockEnterpriseApi = async (page: Page) => {
  await page.route("**/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path === "/v1/portal/auth/exchange" && method === "POST") {
      return fulfillJson(route, { accessToken: "portal-session", expiresAt: "2030-01-01T00:00:00.000Z" });
    }
    if (path === "/v1/portal/overview" && method === "POST") {
      return fulfillJson(route, {
        client: { id: "c1", fullName: "Mario Rossi", email: "mario@example.com" },
        deals: [{ id: "r1", type: "sell", status: "proposal_sent", updatedAt: "2026-03-19T10:00:00.000Z" }],
        documents: [{ id: "d1", title: "Preventivo #001", type: "quote", createdAt: "2026-03-19T09:00:00.000Z" }],
        timeline: [
          { id: "t1", kind: "deal_status", title: "Stato pratica aggiornato a proposal_sent", status: "proposal_sent", at: "2026-03-19T10:00:00.000Z" },
          { id: "t2", kind: "document", title: "Preventivo #001", at: "2026-03-19T09:00:00.000Z" },
        ],
      });
    }
    if (path === "/v1/portal/logout" && method === "POST") return fulfillJson(route, { ok: true });

    if (path === "/v1/workspaces" && method === "GET") {
      return fulfillJson(route, [{ _id: "dev-1", name: "Dev 1", features: ["integrations", "reports", "requests", "calendar", "clients", "apartments"] }]);
    }
    if (path === "/v1/workspaces/dev-1/projects" && method === "GET") return fulfillJson(route, { data: [{ projectId: "p1" }] });
    if (path === "/v1/workspaces/dev-1" && method === "GET") return fulfillJson(route, { workspace: { _id: "dev-1", features: ["integrations"] } });
    if (path === "/v1/notifications" && method === "GET") return fulfillJson(route, { data: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    if (path === "/v1/session/preferences" && method === "POST") {
      return fulfillJson(route, {
        found: true,
        email: PROJECT_SCOPE.email,
        workspaceId: PROJECT_SCOPE.workspaceId,
        selectedProjectIds: PROJECT_SCOPE.selectedProjectIds,
      });
    }
    if (path === "/v1/workspaces/dev-1/webhook-configs" && method === "GET") return fulfillJson(route, { data: [] });
    if (path === "/v1/workspaces/dev-1/connectors/n8n/config" && method === "GET") return fulfillJson(route, { config: null });
    if (path === "/v1/connectors/outlook/status" && method === "GET") return fulfillJson(route, { connected: false });

    if (path === "/v1/workspaces/dev-1/platform-api-keys" && method === "GET") return fulfillJson(route, { data: [] });
    if (path === "/v1/workspaces/dev-1/platform-api-keys/usage" && method === "GET") return fulfillJson(route, { data: [] });
    if (path === "/v1/workspaces/dev-1/platform-api-keys" && method === "POST") {
      return fulfillJson(route, { key: {}, apiKey: "k_live_12345", apiKeyMasked: "k_li...2345" });
    }

    if (path === "/v1/contracts/signature-requests" && method === "POST") return fulfillJson(route, { ok: true });
    if (path === "/v1/contracts/rq-1/signature-status" && method === "GET") {
      return fulfillJson(route, { data: [{ _id: "s1", provider: "yousign", providerRequestId: "ys-1", status: "sent", signingUrl: "https://sign.local/1", createdAt: "2026-03-19T10:00:00.000Z", updatedAt: "2026-03-19T10:00:00.000Z" }] });
    }
    if (path === "/v1/workspaces/dev-1/marketing-workflows" && method === "GET") {
      return fulfillJson(route, { data: [{ _id: "mw1", name: "Drip follow-up", triggerEventType: "request.status_changed", steps: [{}, {}] }] });
    }
    if (path === "/v1/workspaces/dev-1/marketing-workflows" && method === "POST") return fulfillJson(route, { ok: true });
    if (path === "/v1/marketing-workflows/run-due" && method === "POST") return fulfillJson(route, { processed: 1, failed: 0 });
    if (path === "/v1/workspaces/dev-1/mls/mappings" && method === "POST") {
      return fulfillJson(route, { portal: "immobiliare_it", apiKey: "mls_123", apiKeyMasked: "mls_...123" });
    }
    if (path === "/v1/workspaces/dev-1/mls/reconcile" && method === "POST") return fulfillJson(route, { ok: true, checked: 1, issues: 0 });
    if (path === "/v1/workspaces/dev-1/platform/scale-out-decision" && method === "GET") {
      return fulfillJson(route, { recommendation: "modular_monolith_boundaries", candidates: [] });
    }
    if (path === "/v1/workspaces/dev-1/ops/alerts" && method === "GET") {
      return fulfillJson(route, { data: [{ _id: "a1", source: "mls.reconciliation", severity: "warning", title: "MLS warning", message: "Issue found", createdAt: "2026-03-19T10:00:00.000Z", acknowledgedAt: null }] });
    }
    if (path === "/v1/ops/alerts/a1/ack" && method === "POST") return fulfillJson(route, { ok: true });

    return fulfillJson(route, { ok: true });
  });
};

test.describe("Enterprise journeys", () => {
  test("customer portal advanced view renders timeline and filters", async ({ page }) => {
    await installSession(page);
    await mockEnterpriseApi(page);
    await page.goto("/");
    await page.evaluate(() => {
      window.location.assign("/portal?token=magic-token-1");
    });

    await expect(page.getByRole("heading", { name: "Area Cliente" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Timeline attività")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Stato pratica aggiornato a proposal_sent")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Filtra stato pratica")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Filtra documenti")).toBeVisible({ timeout: 15000 });
  });

  test("integrations api tab enterprise modules are operable", async ({ page }) => {
    await installSession(page);
    await mockEnterpriseApi(page);
    await page.goto("/integrations?tab=api");

    await expect(page.getByText("Platform API Governance")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Firma digitale (DocuSign/Yousign)")).toBeVisible();
    await expect(page.getByText("Marketing automation nativa")).toBeVisible();
    await expect(page.getByText("MLS Admin (Immobiliare/Idealista)")).toBeVisible();
    await expect(page.getByText("Scale-out decision gate")).toBeVisible();
    await expect(page.getByText("Alerting operativo")).toBeVisible();

    await page.getByPlaceholder("Request ID").fill("rq-1");
    await page.getByPlaceholder("Nome firmatario").fill("Mario Rossi");
    await page.getByPlaceholder("Email firmatario").fill("mario@example.com");
    await page.getByPlaceholder("Titolo documento").fill("Contratto preliminare");
    await page.getByPlaceholder("https://.../document.pdf").fill("https://example.com/doc.pdf");
    await page.getByRole("button", { name: "Crea richiesta firma" }).click();
    await page.getByRole("button", { name: "Aggiorna status firma" }).click();
    await expect(page.getByText("ys-1")).toBeVisible();

    await page.getByPlaceholder("Nome workflow").fill("Drip Wave");
    await page.getByRole("button", { name: "Crea workflow" }).click();
    await page.getByRole("button", { name: "Esegui due now" }).click();

    await page.getByPlaceholder("Project ID").fill("p1");
    await page.getByRole("button", { name: "Crea/ruota mapping MLS" }).click();
    await expect(page.getByText("API key feed MLS")).toBeVisible();
    await page.getByRole("button", { name: "Run reconciliation" }).click();

    await page.getByRole("button", { name: "Ack" }).click();
  });
});
