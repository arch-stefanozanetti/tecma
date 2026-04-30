import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { flattenTwilioBody, validateTwilioRequest } from "./twilio-signature.util.js";

describe("twilio-signature.util", () => {
  it("valida firma Twilio corretta", () => {
    const authToken = "test-auth-token";
    const url = "https://example.test/v1/workspaces/ws1/zeus/webhooks/twilio/voice";
    const params = { CallSid: "CA123", From: "+39000111222", SpeechResult: "ciao" };
    const payload = `${url}CallSidCA123From+39000111222SpeechResultciao`;
    const sig = crypto.createHmac("sha1", authToken).update(Buffer.from(payload, "utf-8")).digest("base64");
    expect(validateTwilioRequest(authToken, sig, url, params)).toBe(true);
  });

  it("rifiuta firma non valida", () => {
    const ok = validateTwilioRequest("token", "wrong", "https://example.test/hook", { a: "1" });
    expect(ok).toBe(false);
  });

  it("flattenTwilioBody converte solo valori scalari/stringa", () => {
    const flat = flattenTwilioBody({
      a: "x",
      b: 12,
      c: true,
      d: null,
      e: { nested: "ignored" }
    });
    expect(flat).toEqual({ a: "x", b: "12", c: "true" });
  });
});
