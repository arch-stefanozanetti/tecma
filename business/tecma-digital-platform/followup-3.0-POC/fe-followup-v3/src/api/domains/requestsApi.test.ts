import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
  deleteJson: vi.fn(),
}));

vi.mock("../http", () => ({
  getJson: mocks.getJson,
  postJson: mocks.postJson,
  patchJson: mocks.patchJson,
  deleteJson: mocks.deleteJson,
}));

import { requestsApi } from "./requestsApi";

describe("requestsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queryRequests usa POST su /requests/query", () => {
    const query = { workspaceId: "ws1", projectIds: ["p1"], page: 1, perPage: 10 };
    requestsApi.queryRequests(query as never);
    expect(mocks.postJson).toHaveBeenCalledWith("/requests/query", query);
  });

  it("getRequestById usa GET su /requests/:id", () => {
    requestsApi.getRequestById("r1");
    expect(mocks.getJson).toHaveBeenCalledWith("/requests/r1");
  });

  it("transitions/revert/actions usano endpoint corretti", () => {
    requestsApi.getRequestTransitions("r1");
    requestsApi.revertRequestStatus("r1", "t1");
    requestsApi.getRequestActions("ws1");
    requestsApi.getRequestActions("ws 1", "r/1");

    expect(mocks.getJson).toHaveBeenCalledWith("/requests/r1/transitions");
    expect(mocks.postJson).toHaveBeenCalledWith("/requests/r1/revert", { transitionId: "t1" });
    expect(mocks.getJson).toHaveBeenCalledWith("/requests/actions?workspaceId=ws1");
    expect(mocks.getJson).toHaveBeenCalledWith(
      "/requests/actions?workspaceId=ws%201&requestId=r%2F1"
    );
  });

  it("actions CRUD usa endpoint corretti", () => {
    requestsApi.createRequestAction({ workspaceId: "ws1", requestIds: ["r1"], type: "note" });
    requestsApi.updateRequestAction("a1", { title: "X" });
    requestsApi.deleteRequestAction("a1");

    expect(mocks.postJson).toHaveBeenCalledWith("/requests/actions", {
      workspaceId: "ws1",
      requestIds: ["r1"],
      type: "note",
    });
    expect(mocks.patchJson).toHaveBeenCalledWith("/requests/actions/a1", { title: "X" });
    expect(mocks.deleteJson).toHaveBeenCalledWith("/requests/actions/a1");
  });

  it("create/update status e query helper usano endpoint corretti", () => {
    requestsApi.createRequest({ workspaceId: "ws1", projectId: "p1", clientId: "c1", type: "sell" } as never);
    requestsApi.updateRequestStatus("r1", { status: "won", reason: "ok" });
    requestsApi.queryClientsLite("ws 1", ["p1", "p/2"]);
    requestsApi.queryApartments({ workspaceId: "ws1", projectIds: ["p1"], page: 1, perPage: 20 } as never);

    expect(mocks.postJson).toHaveBeenCalledWith(
      "/requests",
      expect.objectContaining({ workspaceId: "ws1", projectId: "p1", clientId: "c1" })
    );
    expect(mocks.patchJson).toHaveBeenCalledWith("/requests/r1/status", { status: "won", reason: "ok" });
    expect(mocks.postJson).toHaveBeenCalledWith("/clients/lite/query", {
      workspaceId: "ws 1",
      projectIds: ["p1", "p/2"],
    });
    expect(mocks.postJson).toHaveBeenCalledWith(
      "/apartments/query",
      expect.objectContaining({ workspaceId: "ws1", projectIds: ["p1"] })
    );
  });
});
