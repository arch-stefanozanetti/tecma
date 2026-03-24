import { describe, it, expect } from "vitest";
import {
  viteBasePrefix,
  pathWithoutBasePath,
  normalizeChannelBasePath,
  buildChannelSwitchHref,
  isDevChannelPickerEnabled,
} from "./devChannelPaths";

describe("devChannelPaths", () => {
  it("picker disattivato sotto Vitest (no fetch manifest nei test UI)", () => {
    expect(isDevChannelPickerEnabled()).toBe(false);
  });

  it("viteBasePrefix rimuove slash finale", () => {
    expect(viteBasePrefix("/app/main/")).toBe("/app/main");
    expect(viteBasePrefix("/")).toBe("");
  });

  it("pathWithoutBasePath estrae suffix sotto il base", () => {
    expect(pathWithoutBasePath("/app/main/login", "/app/main")).toBe("/login");
    expect(pathWithoutBasePath("/app/main", "/app/main")).toBe("/");
    expect(pathWithoutBasePath("/login", "")).toBe("/login");
  });

  it("normalizeChannelBasePath aggiunge slash iniziale e finale", () => {
    expect(normalizeChannelBasePath("app/x")).toBe("/app/x/");
    expect(normalizeChannelBasePath("/app/x/")).toBe("/app/x/");
  });

  it("buildChannelSwitchHref mantiene route e query", () => {
    const href = buildChannelSwitchHref(
      "/app/feature-keycloak/",
      "/app/main/cockpit",
      "?tab=1",
      "#h",
      "/app/main"
    );
    expect(href).toBe("/app/feature-keycloak/cockpit?tab=1#h");
  });

  it("buildChannelSwitchHref con base Vite root", () => {
    const href = buildChannelSwitchHref("/app/main/", "/login", "", "", "");
    expect(href).toBe("/app/main/login");
  });
});
