import { describe, expect, it } from "vitest";
import { previewEmailFlow } from "./emailFlows.service.js";

describe("emailFlows.service", () => {
  it("previewEmailFlow replaces placeholders", () => {
    const r = previewEmailFlow(
      "password_reset",
      "Reset — test",
      "<p><a href=\"{{resetLink}}\">Go</a></p>",
      { resetLink: "https://x/y" }
    );
    expect(r.subject).toBe("Reset — test");
    expect(r.html).toContain("https://x/y");
    expect(r.html).not.toContain("{{resetLink}}");
  });
});
