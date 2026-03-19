import { describe, it, expect } from "vitest";
import { normalizeTwilioWhatsAppParty } from "./whatsapp.service.js";

describe("normalizeTwilioWhatsAppParty", () => {
  it("adds whatsapp prefix and plus for E.164", () => {
    expect(normalizeTwilioWhatsAppParty("+393331112233")).toBe("whatsapp:+393331112233");
  });

  it("normalizes digits only", () => {
    expect(normalizeTwilioWhatsAppParty("393331112233")).toBe("whatsapp:+393331112233");
  });

  it("preserves and fixes existing whatsapp prefix", () => {
    expect(normalizeTwilioWhatsAppParty("whatsapp:+393331112233")).toBe("whatsapp:+393331112233");
    expect(normalizeTwilioWhatsAppParty("WhatsApp:393331112233")).toBe("whatsapp:+393331112233");
  });

  it("strips spaces", () => {
    expect(normalizeTwilioWhatsAppParty("+39 333 111 2233")).toBe("whatsapp:+393331112233");
  });
});
