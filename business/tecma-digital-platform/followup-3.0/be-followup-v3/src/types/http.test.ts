import { describe, it, expect } from "vitest";
import { HttpError } from "./http.js";

describe("HttpError", () => {
  it("creates error with message and default statusCode 400", () => {
    const err = new HttpError("Bad request");
    expect(err.message).toBe("Bad request");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("HttpError");
  });

  it("creates error with custom statusCode", () => {
    const err = new HttpError("Unauthorized", 401);
    expect(err.message).toBe("Unauthorized");
    expect(err.statusCode).toBe(401);
  });

  it("is instanceof Error", () => {
    const err = new HttpError("Test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
  });
});
