import { describe, expect, it } from "vitest";
import { isPublicAppRoute } from "./publicRoutes";

describe("isPublicAppRoute", () => {
  it("include rotte invito e reset password", () => {
    expect(isPublicAppRoute("/set-password")).toBe(true);
    expect(isPublicAppRoute("/reset-password")).toBe(true);
    expect(isPublicAppRoute("/forgot-password")).toBe(true);
  });

  it("include login e report condivisi", () => {
    expect(isPublicAppRoute("/login")).toBe(true);
    expect(isPublicAppRoute("/app/login")).toBe(true);
    expect(isPublicAppRoute("/r/abc")).toBe(true);
  });

  it("esclude rotte autenticate", () => {
    expect(isPublicAppRoute("/")).toBe(false);
    expect(isPublicAppRoute("/clients")).toBe(false);
    expect(isPublicAppRoute("/users")).toBe(false);
  });
});
