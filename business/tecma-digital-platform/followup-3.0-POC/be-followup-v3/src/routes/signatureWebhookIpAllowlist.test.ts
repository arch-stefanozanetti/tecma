import { describe, expect, it } from "vitest";
import {
  isClientIpAllowedForSignatureWebhook,
  parseSignatureWebhookAllowlist,
} from "./signatureWebhookIpAllowlist.js";

describe("parseSignatureWebhookAllowlist", () => {
  it("splitta per virgola e trimma", () => {
    expect(parseSignatureWebhookAllowlist(" 10.0.0.1 , 192.168.0.0/24 ")).toEqual([
      "10.0.0.1",
      "192.168.0.0/24",
    ]);
  });

  it("stringa vuota → []", () => {
    expect(parseSignatureWebhookAllowlist("")).toEqual([]);
  });
});

describe("isClientIpAllowedForSignatureWebhook", () => {
  it("allowlist vuota → sempre consentito", () => {
    expect(isClientIpAllowedForSignatureWebhook("", [])).toBe(true);
    expect(isClientIpAllowedForSignatureWebhook("1.2.3.4", [])).toBe(true);
  });

  it("senza IP → negato se allowlist non vuota", () => {
    expect(isClientIpAllowedForSignatureWebhook("", ["10.0.0.1"])).toBe(false);
  });

  it("match esatto IPv4", () => {
    const entries = parseSignatureWebhookAllowlist("10.0.0.1");
    expect(isClientIpAllowedForSignatureWebhook("10.0.0.1", entries)).toBe(true);
    expect(isClientIpAllowedForSignatureWebhook("192.168.1.1", entries)).toBe(false);
  });

  it("accetta IP in CIDR IPv4", () => {
    const entries = parseSignatureWebhookAllowlist("192.168.1.0/24");
    expect(isClientIpAllowedForSignatureWebhook("192.168.1.99", entries)).toBe(true);
    expect(isClientIpAllowedForSignatureWebhook("192.168.2.1", entries)).toBe(false);
  });
});
