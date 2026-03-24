import { describe, it, expect, afterEach } from "vitest";
import { postAuthRedirectHref, spaAbsolutePath } from "./spaPath";

describe("spaAbsolutePath", () => {
  const originalBase = import.meta.env.BASE_URL;

  afterEach(() => {
    import.meta.env.BASE_URL = originalBase;
  });

  it("con BASE_URL / restituisce il path assoluto dell’app", () => {
    import.meta.env.BASE_URL = "/";
    expect(spaAbsolutePath("/login")).toBe("/login");
  });

  it("con BASE_URL sotto prefisso antepone il prefisso", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(spaAbsolutePath("/login")).toBe("/app/main/login");
  });
});

describe("postAuthRedirectHref (Keycloak / SSO redirect)", () => {
  const originalBase = import.meta.env.BASE_URL;

  afterEach(() => {
    import.meta.env.BASE_URL = originalBase;
  });

  it("path SPA relativo riceve il prefisso base", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("/cockpit")).toBe("/app/main/cockpit");
  });

  it("qualsiasi /login… torna alla home sotto base", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("/login")).toBe("/app/main/");
  });

  it("path che include già il base non viene duplicato", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("/app/main/cockpit")).toBe("/app/main/cockpit");
  });

  it("con base / mantiene il path", () => {
    import.meta.env.BASE_URL = "/";
    expect(postAuthRedirectHref("/inbox")).toBe("/inbox");
  });
});
