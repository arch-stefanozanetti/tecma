import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const insertOne = vi.fn();
  const findOne = vi.fn();
  const updateOne = vi.fn();
  const updateMany = vi.fn();
  const find = vi.fn();
  const sort = vi.fn();
  const limit = vi.fn();
  const toArray = vi.fn();

  limit.mockReturnValue({ toArray });
  sort.mockReturnValue({ limit });
  find.mockReturnValue({ sort });

  return { insertOne, findOne, updateOne, updateMany, find, sort, limit, toArray };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_magic_links") return { insertOne: mocks.insertOne, findOne: mocks.findOne, updateOne: mocks.updateOne };
      if (name === "tz_portal_sessions") return { insertOne: mocks.insertOne, findOne: mocks.findOne, updateOne: mocks.updateOne, updateMany: mocks.updateMany };
      if (name === "tz_clients") return { findOne: mocks.findOne };
      if (name === "tz_requests") return { find: mocks.find };
      if (name === "tz_portal_documents") return { find: mocks.find };
      if (name === "tz_portal_access_audit") return { insertOne: mocks.insertOne };
      return { findOne: mocks.findOne, insertOne: mocks.insertOne, updateOne: mocks.updateOne, find: mocks.find };
    },
  }),
}));

import {
  createCustomerPortalMagicLink,
  exchangeCustomerPortalMagicLink,
  getCustomerPortalOverview,
  logoutCustomerPortalSession,
} from "./customer-portal.service.js";

describe("customer-portal.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toArray.mockResolvedValue([]);
  });

  it("creates magic link", async () => {
    const result = await createCustomerPortalMagicLink({
      workspaceId: "ws1",
      clientId: "c1",
      projectIds: ["p1"],
    });
    expect(result.token).toBeTruthy();
    expect(mocks.insertOne).toHaveBeenCalledOnce();
  });

  it("exchanges magic link token into portal access token", async () => {
    mocks.findOne.mockResolvedValueOnce({
      tokenHash: "hash",
      workspaceId: "ws1",
      clientId: "c1",
      projectIds: ["p1"],
      used: false,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const result = await exchangeCustomerPortalMagicLink({ token: "magic-1" });
    expect(result.accessToken).toBeTruthy();
    expect(mocks.updateMany).toHaveBeenCalledOnce();
    expect(mocks.updateOne).toHaveBeenCalledOnce();
  });

  it("returns portal overview with deals/documents", async () => {
    mocks.findOne
      .mockResolvedValueOnce({
        accessTokenHash: "hash",
        workspaceId: "ws1",
        clientId: "c1",
        projectIds: ["p1"],
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .mockResolvedValueOnce({
        _id: new ObjectId(),
        fullName: "Mario Rossi",
        email: "mario@example.com",
      });

    mocks.toArray
      .mockResolvedValueOnce([
        {
          _id: new ObjectId(),
          type: "sell",
          status: "quote",
          updatedAt: new Date().toISOString(),
          quoteNumber: "Q-1",
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getCustomerPortalOverview({ accessToken: "portal-1" });
    expect(result.client.firstName).toBe("Mario");
    expect(result.client.lastName).toBe("Rossi");
    expect(result.client.fullName).toBe("Mario Rossi");
    expect(result.deals.length).toBe(1);
    expect(result.documents.length).toBe(1);
  });

  it("logout revokes portal session", async () => {
    const result = await logoutCustomerPortalSession({ accessToken: "portal-1" });
    expect(result.ok).toBe(true);
    expect(mocks.updateOne).toHaveBeenCalledOnce();
  });
});
