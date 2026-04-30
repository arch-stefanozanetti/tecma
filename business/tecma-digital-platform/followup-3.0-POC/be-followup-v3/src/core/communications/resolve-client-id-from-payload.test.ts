import { describe, expect, it } from "vitest";
import { resolveClientIdFromDispatchPayload } from "./resolve-client-id-from-payload.js";

describe("resolveClientIdFromDispatchPayload", () => {
  it("prefers explicit clientId", () => {
    expect(
      resolveClientIdFromDispatchPayload({
        workspaceId: "w",
        entityType: "client",
        entityId: "from-entity",
        clientId: "from-field",
      } as never)
    ).toBe("from-field");
  });

  it("uses entityId when entityType is client (es. client.created)", () => {
    expect(
      resolveClientIdFromDispatchPayload({
        workspaceId: "w",
        entityType: "client",
        entityId: "507f1f77bcf86cd799439011",
      } as never)
    ).toBe("507f1f77bcf86cd799439011");
  });

  it("returns undefined for non-client entity without clientId", () => {
    expect(
      resolveClientIdFromDispatchPayload({
        workspaceId: "w",
        entityType: "request",
        entityId: "r1",
      } as never)
    ).toBeUndefined();
  });
});
