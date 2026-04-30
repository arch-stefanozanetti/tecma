import { describe, expect, it } from "vitest";
import {
  parseAptCodeFromPathPlusQuery,
  parseListingFilterParamsFromPathPlusQuery,
} from "./ga4-insights.stub.js";

describe("parseListingFilterParamsFromPathPlusQuery", () => {
  it("parses /appartamenti query params", () => {
    expect(
      parseListingFilterParamsFromPathPlusQuery("/appartamenti?typology=Bilocale&floor=3&price=100-200")
    ).toEqual({
      typology: "Bilocale",
      floor: "3",
      price: "100-200",
    });
  });

  it("accepts /listing path", () => {
    expect(parseListingFilterParamsFromPathPlusQuery("/listing?type=Trilocale")).toEqual({
      typology: "Trilocale",
    });
  });

  it("ignores non-listing paths", () => {
    expect(parseListingFilterParamsFromPathPlusQuery("/appartamento?apt=X")).toEqual({});
  });
});

describe("parseAptCodeFromPathPlusQuery", () => {
  it("reads apt param", () => {
    expect(parseAptCodeFromPathPlusQuery("/appartamento?apt=A2.7")).toBe("A2.7");
  });

  it("returns null without apt", () => {
    expect(parseAptCodeFromPathPlusQuery("/appartamento")).toBeNull();
  });

  it("ignores listing path", () => {
    expect(parseAptCodeFromPathPlusQuery("/appartamenti?x=1")).toBeNull();
  });
});
