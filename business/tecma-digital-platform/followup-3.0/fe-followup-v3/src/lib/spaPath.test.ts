import { describe, it, expect, afterEach, vi } from "vitest";
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

  it("con BASE_URL vuoto si comporta come root", () => {
    import.meta.env.BASE_URL = "";
    expect(spaAbsolutePath("about")).toBe("/about");
  });
});

describe("postAuthRedirectHref (Keycloak / SSO redirect)", () => {
  const originalBase = import.meta.env.BASE_URL;

  afterEach(() => {
    import.meta.env.BASE_URL = originalBase;
  });

  const patchUrlForEmptyPathname = (Original: typeof URL) =>
    function URLPatched(input: string | URL, base?: string | URL) {
      const u = new Original(input, base as never);
      const inputStr = typeof input === "string" ? input : String(input);
      const forceEmpty =
        inputStr === "__REL_EMPTY__" || u.pathname === "/__empty_path";
      if (forceEmpty) {
        Object.defineProperty(u, "pathname", {
          value: "",
          configurable: true,
          enumerable: true,
          writable: true
        });
      }
      return u;
    } as typeof URL;

  it("base senza slash finale viene normalizzato", () => {
    import.meta.env.BASE_URL = "/app/main";
    expect(postAuthRedirectHref("/x")).toBe("/app/main/x");
  });

  it("backTo solo spazi → home sotto base", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("   ")).toBe("/app/main/");
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

  it("URL assoluto same-origin mantiene pathname/search/hash", () => {
    import.meta.env.BASE_URL = "/app/main/";
    const origin = window.location.origin;
    expect(postAuthRedirectHref(`${origin}/app/main/cockpit?q=1#h`)).toBe("/app/main/cockpit?q=1#h");
  });

  it("URL assoluto altro origin → home sotto base", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("https://evil.example/path")).toBe("/app/main/");
  });

  it("input non parsabile → home sotto base", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("http://[")).toBe("/app/main/");
  });

  it("URL assoluto: pathname vuoto dal parser usa / nel redirect", () => {
    import.meta.env.BASE_URL = "/app/main/";
    const Original = globalThis.URL;
    globalThis.URL = patchUrlForEmptyPathname(Original);
    try {
      const origin = window.location.origin;
      expect(postAuthRedirectHref(`${origin}/__empty_path#frag`)).toContain("/app/main/");
    } finally {
      globalThis.URL = Original;
    }
  });

  it("path relativo: pathname vuoto dal parser usa / nel redirect", () => {
    import.meta.env.BASE_URL = "/app/main/";
    const Original = globalThis.URL;
    globalThis.URL = patchUrlForEmptyPathname(Original);
    try {
      expect(postAuthRedirectHref("__REL_EMPTY__")).toContain("/app/main/");
    } finally {
      globalThis.URL = Original;
    }
  });

  it("BASE_URL assente su import.meta.env usa / in basePrefixNoTrail", () => {
    const env = import.meta.env as Record<string, unknown>;
    const prev = env.BASE_URL;
    Reflect.deleteProperty(env, "BASE_URL");
    try {
      expect(postAuthRedirectHref("/rel")).toBe("/rel");
    } finally {
      env.BASE_URL = prev;
    }
  });

  it("path senza prefisso base viene prefissato via spaAbsolutePath", () => {
    import.meta.env.BASE_URL = "/app/main/";
    expect(postAuthRedirectHref("/outside/page")).toBe("/app/main/outside/page");
  });

  it("con origin vuoto, URL assoluto → home (branch !origin)", () => {
    import.meta.env.BASE_URL = "/app/main/";
    const spy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: ""
    } as Location);
    try {
      expect(postAuthRedirectHref("https://example.com/x")).toBe("/app/main/");
    } finally {
      spy.mockRestore();
    }
  });
});
