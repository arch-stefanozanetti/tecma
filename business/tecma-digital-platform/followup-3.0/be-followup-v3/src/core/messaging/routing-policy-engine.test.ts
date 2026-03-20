import { describe, expect, it } from "vitest";
import { getRoutingDecision } from "./routing-policy-engine.js";

describe("getRoutingDecision", () => {
  it("uses aws as primary for sms", () => {
    const route = getRoutingDecision("sms");
    expect(route.primary).toBe("aws_sms");
  });

  it("uses twilio as primary for whatsapp", () => {
    const route = getRoutingDecision("whatsapp");
    expect(route.primary).toBe("twilio");
  });
});

