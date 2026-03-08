import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePaginatedList } from "./usePaginatedList";

const STABLE_WORKSPACE_ID = "w";
const STABLE_PROJECT_IDS = ["p1"];

describe("usePaginatedList", () => {
  it("con enabled true chiama il loader e aggiorna data/total", async () => {
    const loader = vi.fn().mockResolvedValue({
      data: [{ id: "1" }],
      pagination: { total: 1 },
    });
    const { result } = renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        enabled: true,
      })
    );

    expect(result.current.data).toEqual([]);

    await waitFor(() => expect(result.current.data).toEqual([{ id: "1" }]));

    expect(result.current.isLoading).toBe(false);
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        page: 1,
        searchText: "",
      })
    );
    expect(result.current.total).toBe(1);
    expect(result.current.page).toBe(1);
  });

  it("con enabled false non chiama il loader", async () => {
    const loader = vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } });
    renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        enabled: false,
      })
    );

    await waitFor(() => {}); // un tick
    expect(loader).not.toHaveBeenCalled();
  });

  it("refetch incrementa la key e richiama il loader", async () => {
    const loader = vi.fn().mockResolvedValue({
      data: [],
      pagination: { total: 0 },
    });
    const { result } = renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.data).toEqual([]));
    const callsAfterLoad = loader.mock.calls.length;
    expect(callsAfterLoad).toBeGreaterThanOrEqual(1);

    result.current.refetch();
    await waitFor(() => expect(loader.mock.calls.length).toBe(callsAfterLoad + 1));
  });

  it("imposta error quando il loader rigetta", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        enabled: true,
      })
    );
    await waitFor(() => expect(result.current.error).toBe("Network error"));
    expect(result.current.isLoading).toBe(false);
  });

  it("imposta Unknown error quando il loader rigetta con non-Error", async () => {
    const loader = vi.fn().mockRejectedValue("string rejection");
    const { result } = renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        enabled: true,
      })
    );
    await waitFor(() => expect(result.current.error).toBe("Unknown error"));
    expect(result.current.isLoading).toBe(false);
  });

  it("accetta defaultPerPage e lo usa nella query", async () => {
    const loader = vi.fn().mockResolvedValue({
      data: [],
      pagination: { total: 0 },
    });
    renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        defaultPerPage: 50,
        enabled: true,
      })
    );

    await waitFor(() => expect(loader).toHaveBeenCalled());
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({ perPage: 50 })
    );
  });

  it("quando refetch è chiamato mentre il load è in corso, solo l’ultimo risultato aggiorna lo state", async () => {
    let resolveFirst!: (v: { data: { id: string }[]; pagination: { total: number } }) => void;
    let resolveSecond!: (v: { data: { id: string }[]; pagination: { total: number } }) => void;
    const firstPromise = new Promise<{ data: { id: string }[]; pagination: { total: number } }>((r) => {
      resolveFirst = r;
    });
    const secondPromise = new Promise<{ data: { id: string }[]; pagination: { total: number } }>((r) => {
      resolveSecond = r;
    });
    let callCount = 0;
    const loader = vi.fn().mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? firstPromise : secondPromise;
    });

    const { result } = renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        enabled: true,
      })
    );

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));

    result.current.refetch();
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));

    resolveFirst({ data: [{ id: "first" }], pagination: { total: 1 } });
    await waitFor(() => {});

    resolveSecond({ data: [{ id: "second" }], pagination: { total: 1 } });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "second" }]));
  });

  it("quando il primo load rigetta dopo refetch, l'errore del primo non aggiorna lo state", async () => {
    let rejectFirst!: (err: unknown) => void;
    const firstPromise = new Promise<never>((_, rej) => {
      rejectFirst = rej;
    });
    const secondPromise = Promise.resolve({ data: [{ id: "ok" }], pagination: { total: 1 } });
    let callCount = 0;
    const loader = vi.fn().mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? firstPromise : secondPromise;
    });

    const { result } = renderHook(() =>
      usePaginatedList({
        loader,
        workspaceId: STABLE_WORKSPACE_ID,
        projectIds: STABLE_PROJECT_IDS,
        defaultSortField: "updatedAt",
        enabled: true,
      })
    );

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    result.current.refetch();
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));

    rejectFirst(new Error("first error"));
    await waitFor(() => {});

    await waitFor(() => expect(result.current.data).toEqual([{ id: "ok" }]));
    expect(result.current.error).toBeNull();
  });
});
