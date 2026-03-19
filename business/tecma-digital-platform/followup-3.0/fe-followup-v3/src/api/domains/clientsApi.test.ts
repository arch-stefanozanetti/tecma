import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
}));

vi.mock("../http", () => ({
  getJson: mocks.getJson,
  postJson: mocks.postJson,
  patchJson: mocks.patchJson,
}));

import { clientsApi } from "./clientsApi";

describe("clientsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("query/create/update/get client", () => {
    clientsApi.queryClients({ workspaceId: "ws1", projectIds: ["p1"], page: 1, perPage: 20 } as never);
    clientsApi.createClient({ workspaceId: "ws1", projectId: "p1", firstName: "Mario", lastName: "Rossi" } as never);
    clientsApi.updateClient("c1", { firstName: "New", lastName: "Name" });
    clientsApi.getClientById("c1", "ws1");

    expect(mocks.postJson).toHaveBeenCalledWith(
      "/clients/query",
      expect.objectContaining({ workspaceId: "ws1", projectIds: ["p1"] })
    );
    expect(mocks.postJson).toHaveBeenCalledWith(
      "/clients",
      expect.objectContaining({ firstName: "Mario", lastName: "Rossi" })
    );
    expect(mocks.patchJson).toHaveBeenCalledWith("/clients/c1", { firstName: "New", lastName: "Name" });
    expect(mocks.getJson).toHaveBeenCalledWith("/clients/c1?workspaceId=ws1");
  });

  it("actions + requests + additionalInfos costruiscono URL corretti", () => {
    clientsApi.createClientAction("c 1", "mail_sent", "ws1");
    clientsApi.getClientRequests("c/1", "ws 1", ["p1", "p/2"], 3, 25);
    clientsApi.listAdditionalInfos("ws/1");

    expect(mocks.postJson).toHaveBeenCalledWith("/clients/c 1/actions", { type: "mail_sent", workspaceId: "ws1" });
    expect(mocks.getJson).toHaveBeenCalledWith(
      "/clients/c/1/requests?workspaceId=ws%201&projectIds=p1,p%2F2&page=3&perPage=25"
    );
    expect(mocks.getJson).toHaveBeenCalledWith("/workspaces/ws%2F1/additional-infos");
  });
});
