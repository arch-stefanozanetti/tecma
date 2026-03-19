import { describe, expect, it } from "vitest";
import { parseCorsOrigins } from "./corsOrigins.js";

describe("parseCorsOrigins", () => {
  it("returns empty list for empty input", () => {
    expect(parseCorsOrigins("")).toEqual([]);
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  it("accepts https origins", () => {
    expect(parseCorsOrigins("https://app.example.com,https://admin.example.com")).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("accepts localhost over http", () => {
    expect(parseCorsOrigins("http://localhost:5173,http://127.0.0.1:5177")).toEqual([
      "http://localhost:5173",
      "http://127.0.0.1:5177",
    ]);
  });

  it("rejects ambiguous origin without protocol", () => {
    expect(() => parseCorsOrigins("localhost:5173")).toThrow();
  });

  it("rejects non-localhost http origins", () => {
    expect(() => parseCorsOrigins("http://example.com")).toThrow();
  });
});
