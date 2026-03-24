import { describe, it, expect, afterEach } from "vitest";
import { spaAbsolutePath } from "./spaPath";

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
