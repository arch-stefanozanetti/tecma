import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  saveProjectScope,
  loadProjectScope,
  clearProjectScope,
  updateSelectedProjectIds,
  updateWorkspaceId,
  useWorkspace
} from "./projectScope";

const baseState = {
  email: "u@test.com",
  role: "user" as const,
  isAdmin: false,
  workspaceId: "w1",
  projects: [{ id: "p1", name: "P1", displayName: "P1" }],
  selectedProjectIds: ["p1"]
};

describe("projectScope", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
        clear: () => {
          storage = {};
        },
        length: 0,
        key: () => null
      }
    );
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
      length: 0,
      key: () => null
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saveProjectScope e loadProjectScope roundtrip", () => {
    saveProjectScope(baseState);
    expect(loadProjectScope()).toEqual(baseState);
  });

  it("loadProjectScope ritorna null se vuoto", () => {
    expect(loadProjectScope()).toBeNull();
  });

  it("loadProjectScope ritorna null per JSON non valido", () => {
    (localStorage as Storage).setItem("followup3.projectScope", "invalid{");
    expect(loadProjectScope()).toBeNull();
  });

  it("clearProjectScope rimuove dal storage", () => {
    saveProjectScope(baseState);
    clearProjectScope();
    expect(loadProjectScope()).toBeNull();
  });

  it("updateSelectedProjectIds aggiorna solo selectedProjectIds", () => {
    saveProjectScope(baseState);
    updateSelectedProjectIds(["p1", "p2"]);
    const loaded = loadProjectScope();
    expect(loaded?.selectedProjectIds).toEqual(["p1", "p2"]);
    expect(loaded?.email).toBe("u@test.com");
  });

  it("updateSelectedProjectIds non fa nulla se nessuno scope salvato", () => {
    expect(() => updateSelectedProjectIds(["p1"])).not.toThrow();
  });

  it("updateWorkspaceId aggiorna solo workspaceId", () => {
    saveProjectScope(baseState);
    updateWorkspaceId("w2");
    const loaded = loadProjectScope();
    expect(loaded?.workspaceId).toBe("w2");
    expect(loaded?.email).toBe("u@test.com");
  });

  it("updateWorkspaceId non fa nulla se nessuno scope salvato", () => {
    expect(() => updateWorkspaceId("w2")).not.toThrow();
  });

  it("useWorkspace ritorna valori da loadProjectScope", () => {
    saveProjectScope(baseState);
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.workspaceId).toBe("w1");
    expect(result.current.selectedProjectIds).toEqual(["p1"]);
    expect(result.current.email).toBe("u@test.com");
    expect(result.current.isAdmin).toBe(false);
  });

  it("useWorkspace ritorna isAdmin true quando salvato", () => {
    saveProjectScope({ ...baseState, isAdmin: true });
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.isAdmin).toBe(true);
  });

  it("useWorkspace ritorna default se nessuno scope", () => {
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.workspaceId).toBe("");
    expect(result.current.selectedProjectIds).toEqual([]);
    expect(result.current.projects).toEqual([]);
  });
});
