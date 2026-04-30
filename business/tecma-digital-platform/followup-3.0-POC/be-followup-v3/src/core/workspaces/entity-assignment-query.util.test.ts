import { describe, it, expect } from "vitest";
import { shouldApplyEntityAssignmentListFilter, viewerAssignmentUserId } from "./entity-assignment-query.util.js";

describe("entity-assignment-query.util", () => {
  it("non applica filtro senza viewer", () => {
    expect(shouldApplyEntityAssignmentListFilter(undefined)).toBe(false);
  });

  it("non applica filtro per admin o Tecma admin", () => {
    expect(
      shouldApplyEntityAssignmentListFilter({ email: "a@b.com", isAdmin: true, isTecmaAdmin: false })
    ).toBe(false);
    expect(
      shouldApplyEntityAssignmentListFilter({ email: "a@b.com", isAdmin: false, isTecmaAdmin: true })
    ).toBe(false);
  });

  it("applica filtro per utente non admin", () => {
    expect(
      shouldApplyEntityAssignmentListFilter({ email: "Vendor@X.com", isAdmin: false, isTecmaAdmin: false })
    ).toBe(true);
  });

  it("normalizza email per confronto assegnazioni", () => {
    expect(viewerAssignmentUserId({ email: "  U@X.COM ", isAdmin: false })).toBe("u@x.com");
  });
});
