import { describe, expect, it } from "vitest";
import { plainTextToAdf } from "./jira-adf.js";

describe("plainTextToAdf", () => {
  it("produce un documento ADF con un paragrafo per riga", () => {
    const adf = plainTextToAdf("a\nb");
    expect(adf.type).toBe("doc");
    expect(adf.version).toBe(1);
    expect(adf.content).toHaveLength(2);
    expect(adf.content[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "a" }],
    });
    expect(adf.content[1]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "b" }],
    });
  });

  it("gestisce stringa vuota con uno spazio", () => {
    const adf = plainTextToAdf("");
    expect(adf.content).toHaveLength(1);
    expect(adf.content[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: " " }],
    });
  });
});
