import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isLocalDevHost,
  getJwtFromCookie,
  getEmailFromJwtCookie,
  buildBackToFromCurrentLocation,
  buildItdLoginRedirectUrl
} from "./itdLogin";

describe("itdLogin", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: {
        hostname: "localhost",
        href: "http://localhost:5177/",
        origin: "http://localhost:5177",
        pathname: "/",
        search: ""
      },
      writable: true
    });
    document.cookie = "";
  });

  afterEach(() => {
    document.cookie = "";
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  describe("isLocalDevHost", () => {
    it("ritorna true per localhost", () => {
      expect(isLocalDevHost()).toBe(true);
    });

    it("ritorna true per 127.0.0.1", () => {
      Object.defineProperty(window, "location", {
        value: { ...window.location, hostname: "127.0.0.1" },
        writable: true
      });
      expect(isLocalDevHost()).toBe(true);
    });

    it("ritorna false per altro host", () => {
      Object.defineProperty(window, "location", {
        value: { ...window.location, hostname: "app.example.com" },
        writable: true
      });
      expect(isLocalDevHost()).toBe(false);
    });
  });

  describe("getJwtFromCookie", () => {
    it("ritorna null se nessun cookie jwt", () => {
      expect(getJwtFromCookie()).toBeNull();
    });

    it("legge da cookie jwt", () => {
      document.cookie = "jwt=abc.def.ghi";
      expect(getJwtFromCookie()).toBe("abc.def.ghi");
    });

    it("legge da cookie token se jwt assente", () => {
      document.cookie = "jwt=; path=/; max-age=0";
      document.cookie = "token=xyz";
      expect(getJwtFromCookie()).toBe("xyz");
    });
  });

  describe("getEmailFromJwtCookie", () => {
    it("ritorna null se nessun token", () => {
      expect(getEmailFromJwtCookie()).toBeNull();
    });

    it("ritorna email da payload.email se presente", () => {
      const payload = { email: "user@example.com" };
      const b64 = btoa(JSON.stringify(payload));
      document.cookie = `jwt=header.${b64}.sig`;
      expect(getEmailFromJwtCookie()).toBe("user@example.com");
    });

    it("ritorna null per payload non valido", () => {
      document.cookie = "jwt=invalid";
      expect(getEmailFromJwtCookie()).toBeNull();
    });
  });

  describe("buildBackToFromCurrentLocation", () => {
    it("usa backTo dalla query se presente", () => {
      Object.defineProperty(window, "location", {
        value: {
          ...window.location,
          href: "http://localhost:5177/?backTo=http%3A%2F%2Fother%2Fpath",
          search: "?backTo=http%3A%2F%2Fother%2Fpath"
        },
        writable: true
      });
      expect(buildBackToFromCurrentLocation()).toBe("http://other/path");
    });

    it("costruisce URL da origin e pathname senza backTo", () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:5177/app",
          origin: "http://localhost:5177",
          pathname: "/app",
          search: ""
        },
        writable: true
      });
      expect(buildBackToFromCurrentLocation()).toMatch(/http:\/\/localhost:5177\/app/);
    });
  });

  describe("buildItdLoginRedirectUrl", () => {
    it("aggiunge backTo come query alla login URL", () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:5177/",
          origin: "http://localhost:5177",
          pathname: "/",
          search: ""
        },
        writable: true
      });
      const url = buildItdLoginRedirectUrl("https://login.example.com/login");
      expect(url).toMatch(/https:\/\/login\.example\.com\/login/);
      expect(url).toContain("backTo=");
    });

    it("aggiunge backTo alla login URL (con separatore corretto)", () => {
      Object.defineProperty(window, "location", {
        value: { href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "" },
        writable: true
      });
      const url = buildItdLoginRedirectUrl("https://login.example.com/login");
      expect(url).toContain("backTo=");
      expect(url).toMatch(/login\.example\.com/);
    });
  });
});
