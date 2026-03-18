import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

describe("consumeInviteToken (mock DB)", () => {
  it("prima chiamata restituisce il doc, la seconda null", async () => {
    const raw = "b".repeat(64);
    const tokenHash = hashToken(raw);
    let n = 0;
    vi.doMock("../../config/db.js", () => ({
      getDb: () => ({
        collection: () => ({
          findOneAndUpdate: vi.fn(async () => {
            n += 1;
            if (n === 1) {
              return {
                email: "consume-invite@test.local",
                tokenHash,
                role: "vendor",
                projectId: "p1",
                userId: "u1",
                used: false
              };
            }
            return null;
          })
        })
      })
    }));
    vi.resetModules();
    const { consumeInviteToken } = await import("./inviteToken.service.js");
    const first = await consumeInviteToken(raw);
    const second = await consumeInviteToken(raw);
    expect(first?.email).toBe("consume-invite@test.local");
    expect(second).toBeNull();
  });
});

describe("consumePasswordResetToken (mock DB)", () => {
  it("prima chiamata restituisce il doc, la seconda null", async () => {
    const raw = "c".repeat(64);
    const tokenHash = hashToken(raw);
    let n = 0;
    vi.doMock("../../config/db.js", () => ({
      getDb: () => ({
        collection: () => ({
          findOneAndUpdate: vi.fn(async () => {
            n += 1;
            if (n === 1) {
              return {
                userId: "u2",
                email: "reset-consume@test.local",
                tokenHash,
                used: false
              };
            }
            return null;
          })
        })
      })
    }));
    vi.resetModules();
    const { consumePasswordResetToken } = await import("./passwordResetToken.service.js");
    const first = await consumePasswordResetToken(raw);
    const second = await consumePasswordResetToken(raw);
    expect(first?.email).toBe("reset-consume@test.local");
    expect(second).toBeNull();
  });
});
