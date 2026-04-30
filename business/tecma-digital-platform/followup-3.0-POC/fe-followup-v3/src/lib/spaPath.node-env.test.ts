/**
 * Branch `typeof window === "undefined"` in postAuthRedirectHref (SSR / node).
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import { postAuthRedirectHref, spaAbsolutePath } from "./spaPath";

describe("spaPath (ambiente senza window)", () => {
  const originalBase = import.meta.env.BASE_URL;

  afterEach(() => {
    import.meta.env.BASE_URL = originalBase;
  });

  it("postAuthRedirectHref con path relativo usa fallback URL base", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("/inbox")).toBe("/app/main/inbox");
  });

  it("URL assoluto senza window → home sotto base (!origin)", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("https://example.com/x")).toBe("/app/main/");
  });

  it("spaAbsolutePath con BASE_URL sotto prefisso", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(spaAbsolutePath("/x")).toBe("/app/main/x");
  });

  it("BASE_URL solo / produce base vuoto in postAuth (solo node)", () => {
    import.meta.env.BASE_URL = "/";
    expect(postAuthRedirectHref("/inbox")).toBe("/inbox");
  });
});
