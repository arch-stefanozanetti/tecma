import crypto from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { getQuotePublicByToken } from "./quotes.service.js";

const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw, "utf8").digest("hex");

const quotesFindOneMock = vi.fn();
const clientsFindOneMock = vi.fn();
const getPresignedGetUrlMock = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_quotes") return { findOne: quotesFindOneMock };
      if (name === "tz_clients") return { findOne: clientsFindOneMock };
      return { findOne: vi.fn() };
    },
  }),
}));

vi.mock("../assets/assets-s3.service.js", () => ({
  getPresignedGetUrl: (...args: unknown[]) => getPresignedGetUrlMock(...args),
  putObjectBuffer: vi.fn(),
  deleteObject: vi.fn(),
}));

describe("getQuotePublicByToken", () => {
  beforeEach(() => {
    quotesFindOneMock.mockReset();
    clientsFindOneMock.mockReset();
    getPresignedGetUrlMock.mockReset();
  });

  it("returns found false for empty token (no DB lookup for empty)", async () => {
    const r = await getQuotePublicByToken("");
    expect(r.data.found).toBe(false);
    expect(quotesFindOneMock).not.toHaveBeenCalled();
  });

  it("returns found false when no quote matches token hash", async () => {
    quotesFindOneMock.mockResolvedValueOnce(null);
    const r = await getQuotePublicByToken("unknown-token");
    expect(r.data.found).toBe(false);
    expect(quotesFindOneMock).toHaveBeenCalledWith({
      tokenHash: hashToken("unknown-token"),
      status: "sent",
    });
  });

  it("returns found false when quote is past expiry", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    quotesFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId(),
      tokenHash: hashToken("tok"),
      status: "sent",
      quoteNumber: "Q-1",
      totalPrice: 100,
      expiryOn: past,
      clientId: "",
      pdfStorageKey: null,
    });
    const r = await getQuotePublicByToken("tok");
    expect(r.data.found).toBe(false);
  });

  it("returns found true with quote fields and presigned PDF when valid", async () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const oid = new ObjectId();
    const storageKey = "workspaces/ws/quotes/x.pdf";
    quotesFindOneMock.mockResolvedValueOnce({
      _id: oid,
      workspaceId: "ws",
      projectId: "pr",
      tokenHash: hashToken("good-token"),
      status: "sent",
      quoteNumber: "Q-2026-ABC",
      totalPrice: 125_000,
      expiryOn: future,
      clientId: "",
      pdfStorageKey: storageKey,
    });
    const exp = new Date(Date.now() + 900_000);
    getPresignedGetUrlMock.mockResolvedValueOnce({
      downloadUrl: "https://bucket.example/signed",
      expiresAt: exp,
    });

    const r = await getQuotePublicByToken("good-token");
    expect(r.data.found).toBe(true);
    expect(r.data.quoteNumber).toBe("Q-2026-ABC");
    expect(r.data.totalPrice).toBe(125_000);
    expect(r.data.expiryOn).toBe(future);
    expect(r.data.pdfDownloadUrl).toBe("https://bucket.example/signed");
    expect(r.data.pdfExpiresAt).toBe(exp.toISOString());
    expect(getPresignedGetUrlMock).toHaveBeenCalledWith(
      storageKey,
      15 * 60,
      expect.objectContaining({
        entityType: "quote",
        entityId: oid.toHexString(),
        workspaceId: "ws",
        projectId: "pr",
      })
    );
  });

  it("resolves client name when clientId is valid and client exists", async () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const cid = new ObjectId();
    quotesFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId(),
      tokenHash: hashToken("t2"),
      status: "sent",
      quoteNumber: "Q-2",
      totalPrice: 1,
      expiryOn: future,
      clientId: cid.toHexString(),
      pdfStorageKey: null,
    });
    clientsFindOneMock.mockResolvedValueOnce({
      _id: cid,
      firstName: "Mario",
      lastName: "Rossi",
    });

    const r = await getQuotePublicByToken("t2");
    expect(r.data.found).toBe(true);
    expect(r.data.clientName).toBe("Mario Rossi");
  });
});
