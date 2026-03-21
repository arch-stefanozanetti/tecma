import { describe, expect, it } from "vitest";
import { escapeForMongoRegexSubstring, MAX_LIST_SEARCH_TEXT_LENGTH } from "./searchTextRegex.js";

describe("searchTextRegex", () => {
  it("escapeForMongoRegexSubstring neutralizza metacaratteri regex", () => {
    expect(escapeForMongoRegexSubstring("a+b")).toBe("a\\+b");
    expect(escapeForMongoRegexSubstring("x(y)")).toBe("x\\(y\\)");
    expect(escapeForMongoRegexSubstring("1.2")).toBe("1\\.2");
  });

  it("MAX_LIST_SEARCH_TEXT_LENGTH è coerente con list-query", () => {
    expect(MAX_LIST_SEARCH_TEXT_LENGTH).toBe(200);
  });
});
