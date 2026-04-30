import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import {
  saveProjectScope,
  loadProjectScope,
  clearProjectScope,
  updateSelectedProjectIds,
  updateWorkspaceId,
  useWorkspace,
  WorkspaceOverrideProvider
} from "./projectScope";

const baseState = {
  email: "u@test.com",
  role: "user" as const,
  isAdmin: false,
  workspaceId: "w1",
  projects: [{ id: "p1", name: "P1", displayName: "P1" }],
  selectedProjectIds: ["p1"],
  permissions: [] as string[],
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

  it("loadProjectScope ritorna null se Zod safeParse fallisce", () => {
    (localStorage as Storage).setItem(
      "followup3.projectScope",
      JSON.stringify({
        email: "a@b.com",
        role: "user",
        isAdmin: false,
        workspaceId: "w",
        projects: [],
        selectedProjectIds: [],
        apiEnvironment: "non-valido"
      })
    );
    expect(loadProjectScope()).toBeNull();
  });

  it("loadProjectScope imposta displayName dal name se assente", () => {
    saveProjectScope({
      ...baseState,
      projects: [{ id: "p1", name: "SoloNome" }]
    });
    const loaded = loadProjectScope();
    expect(loaded?.projects[0].displayName).toBe("SoloNome");
  });

  it("loadProjectScope normalizza permissions assenti a []", () => {
    (localStorage as Storage).setItem(
      "followup3.projectScope",
      JSON.stringify({
        email: "a@b.com",
        role: "user",
        isAdmin: false,
        workspaceId: "w",
        projects: [{ id: "p1", name: "P1" }],
        selectedProjectIds: ["p1"]
      })
    );
    expect(loadProjectScope()?.permissions).toEqual([]);
  });

  it("clearProjectScope rimuove dal storage", () => {
    saveProjectScope(baseState);
    clearProjectScope();
    expect(loadProjectScope()).toBeNull();
  });

  it("updateSelectedProjectIds mantiene solo projectIds validi", () => {
    saveProjectScope(baseState);
    updateSelectedProjectIds(["p1", "p2"]);
    const loaded = loadProjectScope();
    expect(loaded?.selectedProjectIds).toEqual(["p1"]);
    expect(loaded?.email).toBe("u@test.com");
  });

  it("loadProjectScope seleziona tutti i progetti se selectedProjectIds è vuoto", () => {
    saveProjectScope({
      ...baseState,
      projects: [
        { id: "p1", name: "P1", displayName: "P1" },
        { id: "p2", name: "P2", displayName: "P2" },
      ],
      selectedProjectIds: [],
    });
    const loaded = loadProjectScope();
    expect(loaded?.selectedProjectIds).toEqual(["p1", "p2"]);
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
    expect(result.current.isTecmaAdmin).toBe(false);
  });

  it("useWorkspace ritorna isTecmaAdmin true quando salvato", () => {
    saveProjectScope({ ...baseState, isTecmaAdmin: true });
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.isTecmaAdmin).toBe(true);
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

  it("hasPermission rispetta elenco permessi per non-admin", () => {
    saveProjectScope({
      ...baseState,
      isAdmin: false,
      permissions: ["clients.read"]
    });
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.hasPermission("clients.read")).toBe(true);
    expect(result.current.hasPermission("other.perm")).toBe(false);
  });

  it("hasPermission con * consente qualsiasi permesso (non-admin)", () => {
    saveProjectScope({
      ...baseState,
      isAdmin: false,
      permissions: ["*"]
    });
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.hasPermission("anything")).toBe(true);
  });

  it("hasPermission da admin bypassa il controllo sui permessi", () => {
    saveProjectScope({
      ...baseState,
      isAdmin: true,
      permissions: []
    });
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.hasPermission("any.perm")).toBe(true);
  });

  it("useWorkspace applica override workspace/progetti", () => {
    saveProjectScope(baseState);
    const override = {
      workspaceId: "w-ov",
      selectedProjectIds: ["p-ov"],
      projects: [{ id: "p-ov", name: "OV", displayName: "OV" }]
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(WorkspaceOverrideProvider, { value: override }, children);
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.workspaceId).toBe("w-ov");
    expect(result.current.selectedProjectIds).toEqual(["p-ov"]);
    expect(result.current.projects).toEqual(override.projects);
  });

  it("clearProjectScope ignora errori su removeItem", () => {
    const badRemove = vi.fn(() => {
      throw new Error("blocked");
    });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: badRemove,
      clear: () => {},
      length: 0,
      key: () => null
    });
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: badRemove,
      clear: () => {},
      length: 0,
      key: () => null
    });
    expect(() => clearProjectScope()).not.toThrow();
  });

  it("save/load usa sessionStorage se localStorage non è disponibile", () => {
    vi.stubGlobal("localStorage", null as unknown as Storage);
    const session: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => session[key] ?? null,
      setItem: (key: string, value: string) => {
        session[key] = value;
      },
      removeItem: (key: string) => {
        delete session[key];
      },
      clear: () => {
        Object.keys(session).forEach((k) => delete session[k]);
      },
      length: 0,
      key: () => null
    });
    saveProjectScope(baseState);
    expect(loadProjectScope()).toEqual(baseState);
  });

  it("getStorage usa sessionStorage se accesso a localStorage lancia", () => {
    const session: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => session[key] ?? null,
      setItem: (key: string, value: string) => {
        session[key] = value;
      },
      removeItem: (key: string) => {
        delete session[key];
      },
      clear: () => {
        Object.keys(session).forEach((k) => delete session[k]);
      },
      length: 0,
      key: () => null
    });
    const desc = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      }
    });
    try {
      saveProjectScope(baseState);
      expect(loadProjectScope()).toEqual(baseState);
    } finally {
      if (desc) Object.defineProperty(window, "localStorage", desc);
    }
  });

  it("getStorage ritorna null se anche sessionStorage non è usabile", () => {
    vi.stubGlobal("localStorage", null as unknown as Storage);
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      }
    });
    const desc = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    try {
      expect(loadProjectScope()).toBeNull();
      saveProjectScope(baseState);
    } finally {
      if (desc) Object.defineProperty(window, "sessionStorage", desc);
    }
  });
});
