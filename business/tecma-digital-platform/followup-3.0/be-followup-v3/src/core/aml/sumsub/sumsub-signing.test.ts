import { describe, expect, it } from "vitest";
import { signSumsubRequest, verifySumsubWebhookSignature } from "./sumsub-signing.js";
import crypto from "node:crypto";

describe("sumsub-signing", () => {
  it("signSumsubRequest produces deterministic structure", () => {
    const { ts, signature } = signSumsubRequest({
      secretKey: "test-secret",
      method: "POST",
      pathWithQuery: "/resources/applicants?levelName=id-and-liveness",
      body: '{"externalUserId":"abc"}',
    });
    expect(ts.length).toBeGreaterThan(5);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifySumsubWebhookSignature accepts hex digest header", () => {
    const secret = "whsec";
    const raw = Buffer.from(JSON.stringify({ type: "applicantReviewed" }), "utf8");
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const ok = verifySumsubWebhookSignature(raw, secret, { "x-payload-digest": expected });
    expect(ok).toBe(true);
  });
});
