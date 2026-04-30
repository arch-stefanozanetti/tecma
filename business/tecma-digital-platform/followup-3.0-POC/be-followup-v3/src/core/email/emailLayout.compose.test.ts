import { describe, expect, it } from "vitest";
import {
  composeLayoutToHtml,
  mixWithAllowedPlaceholders,
  sanitizeRichEmailFragment,
  sanitizeTransactionalEmailHtml
} from "./emailLayout.compose.js";

describe("emailLayout.compose", () => {
  it("mixWithAllowedPlaceholders escapes html and keeps allowed tokens", () => {
    const allowed = new Set(["inviteLink"]);
    expect(mixWithAllowedPlaceholders('<b>x</b> {{inviteLink}}', allowed)).toBe(
      "&lt;b&gt;x&lt;/b&gt; {{inviteLink}}"
    );
    expect(mixWithAllowedPlaceholders("{{evil}}", allowed)).toBe("");
  });

  it("composeLayoutToHtml produces sanitized html with placeholder in href", () => {
    process.env.EMAIL_ASSET_URL_HOSTS = "*";
    const html = composeLayoutToHtml("password_reset", {
      logoUrl: "",
      primaryColor: "#112233",
      blocks: [
        { type: "heading", text: "Reset" },
        { type: "text", text: "Clicca il pulsante." },
        { type: "button", label: "Vai", href: "{{resetLink}}" }
      ]
    });
    expect(html).toContain("{{resetLink}}");
    expect(html).not.toContain("<script");
    expect(html).toContain("Reset");
  });

  it("sanitizeTransactionalEmailHtml preserves placeholders in links", () => {
    const raw = `<p><a href="{{resetLink}}">x</a></p>`;
    const out = sanitizeTransactionalEmailHtml(raw);
    expect(out).toContain("{{resetLink}}");
  });

  it("sanitizeRichEmailFragment keeps lists and bold", () => {
    process.env.EMAIL_ASSET_URL_HOSTS = "*";
    const allowed = new Set(["projectName"]);
    const raw = "<p><strong>Hi</strong></p><ul><li>uno</li><li>{{projectName}}</li></ul>";
    const out = sanitizeRichEmailFragment(raw, allowed);
    expect(out).toContain("<strong>");
    expect(out).toContain("ul");
    expect(out).toContain("{{projectName}}");
  });
});
