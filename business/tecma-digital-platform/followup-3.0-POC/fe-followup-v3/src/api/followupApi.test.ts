import { describe, it, expect, vi, beforeEach } from "vitest";
import { followupApi } from "./followupApi";
import * as http from "./http";
import { API_BASE_URL } from "./http";

vi.mock("./http", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./http")>();
  return {
    ...mod,
    postJson: vi.fn(),
    getJson: vi.fn(),
    patchJson: vi.fn(),
    putJson: vi.fn(),
    deleteJson: vi.fn(),
    postFormData: vi.fn()
  };
});

describe("followupApi", () => {
  beforeEach(() => {
    vi.mocked(http.postJson).mockResolvedValue({} as never);
    vi.mocked(http.getJson).mockResolvedValue({} as never);
    vi.mocked(http.patchJson).mockResolvedValue({} as never);
    vi.mocked(http.putJson).mockResolvedValue({} as never);
    vi.mocked(http.deleteJson).mockResolvedValue({} as never);
  });

  it("queryClients chiama postJson con /clients/query", async () => {
    const query = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "name", direction: 1 }, filters: {} };
    await followupApi.clients.queryClients(query);

    expect(http.postJson).toHaveBeenCalledWith("/clients/query", query);
  });

  it("login con fetch ritorna token quando MFA non richiesto", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          mfaRequired: false,
          accessToken: "at",
          refreshToken: "rt",
          user: { id: "1", email: "a@b.c", role: null, isAdmin: false }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", mockFetch);
    const r = await followupApi.login("a@b.c", "secret");
    expect(r).toEqual({
      mfaRequired: false,
      accessToken: "at",
      refreshToken: "rt",
      user: { id: "1", email: "a@b.c", role: null, isAdmin: false }
    });
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/auth/login`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.c", password: "secret" })
      })
    );
    vi.unstubAllGlobals();
  });

  it("login con MFA ritorna mfaToken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ mfaRequired: true, mfaToken: "tok", expiresIn: "5m" }), { status: 200 })
      )
    );
    const r = await followupApi.login("a@b.c", "secret");
    expect(r).toEqual({ mfaRequired: true, mfaToken: "tok", expiresIn: "5m" });
    vi.unstubAllGlobals();
  });

  it("login errore JSON lancia HttpApiError con code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Bloccato", code: "ACCOUNT_LOCKED" }), { status: 423 })
      )
    );
    await expect(followupApi.login("a@b.c", "secret")).rejects.toMatchObject({
      name: "HttpApiError",
      message: "Bloccato",
      code: "ACCOUNT_LOCKED"
    });
    vi.unstubAllGlobals();
  });

  it("verifyMfaLogin chiama postJson", async () => {
    vi.mocked(http.postJson).mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      user: { id: "1", email: "x@y.z", role: null, isAdmin: false }
    } as never);
    await followupApi.verifyMfaLogin("mt", "123456");
    expect(http.postJson).toHaveBeenCalledWith("/auth/mfa/verify", { mfaToken: "mt", code: "123456" });
  });

  it("startMfaSetup e confirmMfaSetup e disableMfa chiamano postJson", async () => {
    vi.mocked(http.postJson).mockResolvedValue({ otpauthUrl: "otpauth://x" } as never);
    await followupApi.startMfaSetup();
    expect(http.postJson).toHaveBeenCalledWith("/auth/mfa/setup/start", {});
    vi.mocked(http.postJson).mockResolvedValue({ backupCodes: ["a", "b"] } as never);
    await followupApi.confirmMfaSetup(" 123456 ");
    expect(http.postJson).toHaveBeenCalledWith("/auth/mfa/setup/confirm", { code: "123456" });
    vi.mocked(http.postJson).mockResolvedValue({ ok: true } as never);
    await followupApi.disableMfa("999999");
    expect(http.postJson).toHaveBeenCalledWith("/auth/mfa/disable", { code: "999999" });
  });

  it("me chiama getJson con /auth/me", async () => {
    await followupApi.me();

    expect(http.getJson).toHaveBeenCalledWith("/auth/me");
  });

  it("getClientById chiama getJson con path client", async () => {
    await followupApi.clients.getClientById("client-1", "w1");

    expect(http.getJson).toHaveBeenCalledWith("/clients/client-1?workspaceId=w1");
  });

  it("updateClient chiama patchJson con path client", async () => {
    await followupApi.clients.updateClient("c1", { firstName: "Mario", lastName: "Rossi" });

    expect(http.patchJson).toHaveBeenCalledWith("/clients/c1", { firstName: "Mario", lastName: "Rossi" });
  });

  it("deleteCalendarEvent chiama deleteJson", async () => {
    await followupApi.deleteCalendarEvent("e1");

    expect(http.deleteJson).toHaveBeenCalledWith("/calendar/events/e1");
  });

  it("getTemplateConfiguration chiama getJson con projectId in query", async () => {
    await followupApi.getTemplateConfiguration("proj-1");

    expect(http.getJson).toHaveBeenCalledWith("/templates/configuration?projectId=proj-1");
  });

  it("queryCalendar chiama postJson", async () => {
    const q = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "start", direction: 1 }, filters: {} };
    await followupApi.queryCalendar(q);
    expect(http.postJson).toHaveBeenCalledWith("/calendar/events/query", q);
  });

  it("createCalendarEvent chiama postJson", async () => {
    await followupApi.createCalendarEvent({ workspaceId: "w", projectId: "p", title: "E", start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/calendar/events", expect.any(Object));
  });

  it("updateCalendarEvent chiama patchJson", async () => {
    await followupApi.updateCalendarEvent("e1", { title: "Updated" } as never);
    expect(http.patchJson).toHaveBeenCalledWith("/calendar/events/e1", expect.any(Object));
  });

  it("createClient chiama postJson", async () => {
    await followupApi.clients.createClient({ workspaceId: "w", projectId: "p", firstName: "Mario", lastName: "Rossi" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/clients", expect.any(Object));
  });

  it("getClientRequests chiama getJson con query params", async () => {
    await followupApi.clients.getClientRequests("c1", "w1", ["p1"], 2, 50);
    expect(http.getJson).toHaveBeenCalledWith(expect.stringContaining("/clients/c1/requests"));
    expect(http.getJson).toHaveBeenCalledWith(expect.stringMatching(/workspaceId=w1/));
  });

  it("queryApartments chiama postJson", async () => {
    const q = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "name", direction: 1 }, filters: {} };
    await followupApi.apartments.queryApartments(q);
    expect(http.postJson).toHaveBeenCalledWith("/apartments/query", q);
  });

  it("queryRequests chiama postJson", async () => {
    const q = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "createdAt", direction: -1 }, filters: {} };
    await followupApi.queryRequests(q);
    expect(http.postJson).toHaveBeenCalledWith("/requests/query", q);
  });

  it("getRequestById chiama getJson", async () => {
    await followupApi.getRequestById("r1");
    expect(http.getJson).toHaveBeenCalledWith("/requests/r1");
  });

  it("listWorkspaces chiama getJson", async () => {
    await followupApi.listWorkspaces();
    expect(http.getJson).toHaveBeenCalledWith("/workspaces");
  });

  it("inviteUser posta su /users con appPublicUrl esplicito e body completo", async () => {
    await followupApi.inviteUser({
      email: "inv@tecma.test",
      projectId: "proj-99",
      projectName: "Nome progetto",
      appPublicUrl: "https://followup.custom.example/",
      roleLabel: "Vendor",
    });
    expect(http.postJson).toHaveBeenCalledWith("/users", {
      email: "inv@tecma.test",
      projectId: "proj-99",
      projectName: "Nome progetto",
      appPublicUrl: "https://followup.custom.example/",
      roleLabel: "Vendor",
    });
  });

  it("inviteUser include appPublicUrl da window.location.origin se omesso", async () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, origin: "https://fe-origin.test" },
      writable: true,
      configurable: true,
    });
    await followupApi.inviteUser({
      email: "auto@url.test",
      projectId: "p",
      projectName: "P",
    });
    expect(http.postJson).toHaveBeenCalledWith(
      "/users",
      expect.objectContaining({
        email: "auto@url.test",
        projectId: "p",
        projectName: "P",
        appPublicUrl: "https://fe-origin.test",
      })
    );
  });

  it("getWorkspaceById chiama getJson", async () => {
    await followupApi.getWorkspaceById("w1");
    expect(http.getJson).toHaveBeenCalledWith("/workspaces/w1");
  });

  it("createWorkspace chiama postJson", async () => {
    await followupApi.createWorkspace({ name: "Ws" });
    expect(http.postJson).toHaveBeenCalledWith("/workspaces", { name: "Ws" });
  });

  it("updateWorkspace chiama patchJson", async () => {
    await followupApi.updateWorkspace("w1", { name: "New" });
    expect(http.patchJson).toHaveBeenCalledWith("/workspaces/w1", { name: "New" });
  });

  it("deleteWorkspace chiama deleteJson", async () => {
    await followupApi.deleteWorkspace("w1");
    expect(http.deleteJson).toHaveBeenCalledWith("/workspaces/w1");
  });

  it("getWorkspaceAiConfig chiama getJson", async () => {
    await followupApi.getWorkspaceAiConfig("w1");
    expect(http.getJson).toHaveBeenCalledWith("/workspaces/w1/ai-config");
  });

  it("putWorkspaceAiConfig chiama putJson", async () => {
    await followupApi.putWorkspaceAiConfig("w1", { provider: "claude", apiKey: "sk-x" });
    expect(http.putJson).toHaveBeenCalledWith("/workspaces/w1/ai-config", { provider: "claude", apiKey: "sk-x" });
  });

  it("listWorkspaceProjects chiama getJson", async () => {
    await followupApi.listWorkspaceProjects("w1");
    expect(http.getJson).toHaveBeenCalledWith("/workspaces/w1/projects");
  });

  it("associateProjectToWorkspace chiama postJson", async () => {
    await followupApi.associateProjectToWorkspace({ workspaceId: "w1", projectId: "p1" });
    expect(http.postJson).toHaveBeenCalledWith("/workspaces/projects/associate", { workspaceId: "w1", projectId: "p1" });
  });

  it("dissociateProjectFromWorkspace chiama deleteJson", async () => {
    await followupApi.dissociateProjectFromWorkspace("w1", "p1");
    expect(http.deleteJson).toHaveBeenCalledWith("/workspaces/w1/projects/p1");
  });

  it("listAdditionalInfos chiama getJson", async () => {
    await followupApi.listAdditionalInfos("w1");
    expect(http.getJson).toHaveBeenCalledWith("/workspaces/w1/additional-infos");
  });

  it("createAdditionalInfo chiama postJson", async () => {
    await followupApi.createAdditionalInfo({ workspaceId: "w1", key: "k", value: "v" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/additional-infos", expect.any(Object));
  });

  it("updateAdditionalInfo chiama patchJson", async () => {
    await followupApi.updateAdditionalInfo("id1", { value: "v2" });
    expect(http.patchJson).toHaveBeenCalledWith("/additional-infos/id1", { value: "v2" });
  });

  it("deleteAdditionalInfo chiama deleteJson", async () => {
    await followupApi.deleteAdditionalInfo("id1");
    expect(http.deleteJson).toHaveBeenCalledWith("/additional-infos/id1");
  });

  it("getWorkflowConfig chiama getJson con flowType", async () => {
    await followupApi.getWorkflowConfig("w1", "p1", "rent");
    expect(http.getJson).toHaveBeenCalledWith(expect.stringMatching(/flowType=rent/));
  });

  it("createRequest chiama postJson", async () => {
    await followupApi.createRequest({ workspaceId: "w", projectId: "p", apartmentId: "a", clientId: "c", status: "new" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/requests", expect.any(Object));
  });

  it("updateRequestStatus chiama patchJson", async () => {
    await followupApi.updateRequestStatus("r1", { status: "approved" });
    expect(http.patchJson).toHaveBeenCalledWith("/requests/r1/status", { status: "approved" });
  });

  it("getProjectsByEmail chiama postJson", async () => {
    await followupApi.getProjectsByEmail("u@test.com");
    expect(http.postJson).toHaveBeenCalledWith("/session/projects-by-email", { email: "u@test.com" });
  });

  it("getProjectsByEmail con workspaceId include workspaceId nel body", async () => {
    await followupApi.getProjectsByEmail("u@test.com", "ws-1");
    expect(http.postJson).toHaveBeenCalledWith("/session/projects-by-email", { email: "u@test.com", workspaceId: "ws-1" });
  });

  it("getUserPreferences chiama getJson", async () => {
    await followupApi.getUserPreferences("u@test.com");
    expect(http.getJson).toHaveBeenCalledWith(expect.stringContaining("session/preferences"));
  });

  it("saveUserPreferences chiama postJson", async () => {
    await followupApi.saveUserPreferences("u@test.com", "w1", ["p1"]);
    expect(http.postJson).toHaveBeenCalledWith("/session/preferences", { email: "u@test.com", workspaceId: "w1", selectedProjectIds: ["p1"] });
  });

  it("ssoExchange chiama postJson", async () => {
    await followupApi.ssoExchange("jwt");
    expect(http.postJson).toHaveBeenCalledWith("/auth/sso-exchange", { ssoJwt: "jwt" });
  });

  it("refresh chiama postJson", async () => {
    await followupApi.refresh("rt");
    expect(http.postJson).toHaveBeenCalledWith("/auth/refresh", { refreshToken: "rt" });
  });

  it("logout chiama postJson", async () => {
    await followupApi.logout("rt");
    expect(http.postJson).toHaveBeenCalledWith("/auth/logout", { refreshToken: "rt" });
  });

  it("createApartment chiama postJson", async () => {
    await followupApi.apartments.createApartment({ workspaceId: "w", projectId: "p", title: "Apt" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/apartments", expect.any(Object));
  });

  it("updateApartment chiama patchJson", async () => {
    await followupApi.apartments.updateApartment("a1", { title: "Updated" });
    expect(http.patchJson).toHaveBeenCalledWith("/apartments/a1", { title: "Updated" });
  });

  it("getApartmentById chiama getJson", async () => {
    await followupApi.apartments.getApartmentById("a1", "w1");
    expect(http.getJson).toHaveBeenCalledWith("/apartments/a1?workspaceId=w1");
  });

  it("getApartmentRequests chiama getJson", async () => {
    await followupApi.apartments.getApartmentRequests("a1", "w1", ["p1"]);
    expect(http.getJson).toHaveBeenCalledWith(expect.stringContaining("/apartments/a1/requests"));
  });

  it("upsertHCApartment chiama postJson", async () => {
    await followupApi.upsertHCApartment({ apartmentId: "a1" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/hc/apartments", expect.any(Object));
  });

  it("patchHCApartment chiama patchJson", async () => {
    await followupApi.patchHCApartment("a1", {});
    expect(http.patchJson).toHaveBeenCalledWith("/hc/apartments/a1", {});
  });

  it("getHCApartment chiama getJson", async () => {
    await followupApi.getHCApartment("a1");
    expect(http.getJson).toHaveBeenCalledWith("/hc/apartments/a1");
  });

  it("queryHCApartments chiama postJson", async () => {
    const q = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "id", direction: 1 }, filters: {} };
    await followupApi.queryHCApartments(q);
    expect(http.postJson).toHaveBeenCalledWith("/hc/apartments/query", q);
  });

  it("createAssociation chiama postJson", async () => {
    await followupApi.createAssociation({ workspaceId: "w", projectId: "p", apartmentId: "a", clientId: "c" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/associations/apartment-client", expect.any(Object));
  });

  it("queryAssociations chiama postJson", async () => {
    const q = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "id", direction: 1 }, filters: {} };
    await followupApi.queryAssociations(q);
    expect(http.postJson).toHaveBeenCalledWith("/associations/query", q);
  });

  it("deleteAssociation chiama deleteJson", async () => {
    await followupApi.deleteAssociation("assoc1");
    expect(http.deleteJson).toHaveBeenCalledWith("/associations/assoc1");
  });

  it("previewCompleteFlow chiama postJson", async () => {
    await followupApi.previewCompleteFlow({ workspaceId: "w", projectId: "p" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/workflows/complete-flow/preview", expect.any(Object));
  });

  it("executeCompleteFlow chiama postJson", async () => {
    await followupApi.executeCompleteFlow({ workspaceId: "w", projectId: "p" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/workflows/complete-flow/execute", expect.any(Object));
  });

  it("queryHCMaster chiama postJson", async () => {
    const q = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "id", direction: 1 }, filters: {} };
    await followupApi.queryHCMaster("catalog", q);
    expect(http.postJson).toHaveBeenCalledWith("/hc-master/catalog/query", q);
  });

  it("createHCMaster chiama postJson", async () => {
    await followupApi.createHCMaster("catalog", { id: "x", name: "N" } as never);
    expect(http.postJson).toHaveBeenCalledWith("/hc-master/catalog", { id: "x", name: "N" });
  });

  it("updateHCMaster chiama patchJson", async () => {
    await followupApi.updateHCMaster("catalog", "id1", { name: "N2" });
    expect(http.patchJson).toHaveBeenCalledWith("/hc-master/catalog/id1", { name: "N2" });
  });

  it("deleteHCMaster chiama deleteJson", async () => {
    await followupApi.deleteHCMaster("catalog", "id1");
    expect(http.deleteJson).toHaveBeenCalledWith("/hc-master/catalog/id1");
  });

  it("saveTemplateConfiguration chiama putJson", async () => {
    await followupApi.saveTemplateConfiguration("p1", "w1", { schemaVersion: 1 } as never);
    expect(http.putJson).toHaveBeenCalledWith("/templates/configuration/p1", { workspaceId: "w1", template: expect.any(Object) });
  });

  it("validateTemplateConfiguration chiama postJson", async () => {
    await followupApi.validateTemplateConfiguration("p1", { schemaVersion: 1 } as never);
    expect(http.postJson).toHaveBeenCalledWith("/templates/configuration/p1/validate", { template: expect.any(Object) });
  });

  it("queryClientsLite chiama postJson", async () => {
    await followupApi.queryClientsLite("w1", ["p1"]);
    expect(http.postJson).toHaveBeenCalledWith("/clients/lite/query", { workspaceId: "w1", projectIds: ["p1"] });
  });

  it("getAiSuggestions chiama getJson con query", async () => {
    await followupApi.getAiSuggestions("w1", ["p1", "p2"], 10);
    expect(http.getJson).toHaveBeenCalledWith(
      expect.stringMatching(/^\/ai\/suggestions\?workspaceId=w1&limit=10&projectIds=p1&projectIds=p2$/)
    );
  });

  it("generateAiSuggestions chiama postJson", async () => {
    await followupApi.generateAiSuggestions("w1", ["p1"], 10);
    expect(http.postJson).toHaveBeenCalledWith("/ai/suggestions", { workspaceId: "w1", projectIds: ["p1"], limit: 10 });
  });

  it("decideAiSuggestion chiama postJson", async () => {
    await followupApi.decideAiSuggestion("s1", "approved", "u@test.com", "note");
    expect(http.postJson).toHaveBeenCalledWith("/ai/approvals", { suggestionId: "s1", decision: "approved", actorEmail: "u@test.com", note: "note" });
  });

  it("executeAiSuggestion chiama postJson", async () => {
    await followupApi.executeAiSuggestion("s1", { actorEmail: "u@test.com", note: "n" });
    expect(http.postJson).toHaveBeenCalledWith("/ai/suggestions/s1/execute", {
      actorEmail: "u@test.com",
      note: "n"
    });
  });

  it("createAiActionDraft chiama postJson", async () => {
    await followupApi.createAiActionDraft({
      workspaceId: "w",
      projectId: "p",
      suggestionId: "s",
      actionType: "create_task",
      title: "T",
      message: "M",
      target: {}
    });
    expect(http.postJson).toHaveBeenCalledWith("/ai/actions/drafts", expect.any(Object));
  });

  it("queryAiActionDrafts chiama postJson", async () => {
    const q = { workspaceId: "w", projectIds: ["p"], page: 1, perPage: 25, searchText: "", sort: { field: "id", direction: 1 }, filters: {} };
    await followupApi.queryAiActionDrafts(q);
    expect(http.postJson).toHaveBeenCalledWith("/ai/actions/drafts/query", q);
  });

  it("decideAiActionDraft chiama postJson", async () => {
    await followupApi.decideAiActionDraft("d1", "rejected", "u@test.com");
    expect(http.postJson).toHaveBeenCalledWith("/ai/actions/drafts/d1/decision", { decision: "rejected", actorEmail: "u@test.com", note: "" });
  });
});
