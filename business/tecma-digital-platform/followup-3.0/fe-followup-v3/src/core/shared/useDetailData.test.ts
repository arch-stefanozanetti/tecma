import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDetailData } from "./useDetailData";

const mockQueryRequests = vi.fn();

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryRequests: (...args: unknown[]) => mockQueryRequests(...args),
  },
}));

type FakeEntity = { id: string; projectId: string };

describe("useDetailData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRequests.mockResolvedValue({ data: [] });
  });

  it("carica entity al cambio entityId", async () => {
    const loadEntity = vi.fn().mockResolvedValue({ id: "e1", projectId: "p1" });
    const { result, rerender } = renderHook(
      ({ entityId }) =>
        useDetailData<FakeEntity>({
          entityId,
          workspaceId: "ws1",
          selectedProjectIds: ["p1"],
          loadEntity,
          getProjectIdsFromEntity: (e) => [e.projectId],
          requestFilterKey: "entityId",
          notFoundMessage: "Non trovato",
        }),
      { initialProps: { entityId: undefined as string | undefined } }
    );

    expect(result.current.entity).toBeNull();
    expect(result.current.loading).toBe(false);

    rerender({ entityId: "e1" });
    await waitFor(() => expect(result.current.loading).toBe(true));
    await waitFor(() => expect(result.current.entity).toEqual({ id: "e1", projectId: "p1" }));
    expect(result.current.loading).toBe(false);
    expect(loadEntity).toHaveBeenCalledWith("e1");

    loadEntity.mockResolvedValueOnce({ id: "e2", projectId: "p1" });
    rerender({ entityId: "e2" });
    await waitFor(() => expect(result.current.entity).toEqual({ id: "e2", projectId: "p1" }));
    expect(loadEntity).toHaveBeenCalledWith("e2");
  });

  it("carica requests quando entity e deps sono pronti", async () => {
    const loadEntity = vi.fn().mockResolvedValue({ id: "e1", projectId: "p1" });
    const { result } = renderHook(() =>
      useDetailData<FakeEntity>({
        entityId: "e1",
        workspaceId: "ws1",
        selectedProjectIds: ["p1"],
        loadEntity,
        getProjectIdsFromEntity: (e) => [e.projectId],
        requestFilterKey: "entityId",
        notFoundMessage: "Non trovato",
      })
    );

    await waitFor(() => expect(result.current.entity).not.toBeNull());
    await waitFor(() => expect(mockQueryRequests).toHaveBeenCalled());
    expect(mockQueryRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws1",
        projectIds: ["p1"],
        filters: { entityId: "e1" },
      })
    );
  });

  it("reloadRequests incrementa version e ritrigghera le requests", async () => {
    const loadEntity = vi.fn().mockResolvedValue({ id: "e1", projectId: "p1" });
    const { result } = renderHook(() =>
      useDetailData<FakeEntity>({
        entityId: "e1",
        workspaceId: "ws1",
        selectedProjectIds: ["p1"],
        loadEntity,
        getProjectIdsFromEntity: (e) => [e.projectId],
        requestFilterKey: "entityId",
        notFoundMessage: "Non trovato",
      })
    );

    await waitFor(() => expect(mockQueryRequests).toHaveBeenCalledTimes(1));
    result.current.reloadRequests();
    await waitFor(() => expect(mockQueryRequests).toHaveBeenCalledTimes(2));
  });

  it("non setState dopo unmount (cleanup)", async () => {
    const loadEntity = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ id: "e1", projectId: "p1" }), 50)));
    const { result, unmount } = renderHook(() =>
      useDetailData<FakeEntity>({
        entityId: "e1",
        workspaceId: "ws1",
        selectedProjectIds: ["p1"],
        loadEntity,
        getProjectIdsFromEntity: (e) => [e.projectId],
        requestFilterKey: "entityId",
        notFoundMessage: "Non trovato",
      })
    );

    expect(result.current.loading).toBe(true);
    unmount();
    await new Promise((r) => setTimeout(r, 100));
    expect(loadEntity).toHaveBeenCalled();
  });

  it("non chiama loadEntity se manca workspaceId", async () => {
    const loadEntity = vi.fn().mockResolvedValue({ id: "e1", projectId: "p1" });
    renderHook(() =>
      useDetailData<FakeEntity>({
        entityId: "e1",
        workspaceId: undefined,
        selectedProjectIds: ["p1"],
        loadEntity,
        getProjectIdsFromEntity: (e) => [e.projectId],
        requestFilterKey: "entityId",
        notFoundMessage: "Non trovato",
      })
    );

    await waitFor(() => expect(loadEntity).not.toHaveBeenCalled());
    expect(loadEntity).not.toHaveBeenCalled();
  });

  it("imposta error e entity null su loadEntity reject", async () => {
    const loadEntity = vi.fn().mockRejectedValue(new Error("not found"));
    const { result } = renderHook(() =>
      useDetailData<FakeEntity>({
        entityId: "e1",
        workspaceId: "ws1",
        selectedProjectIds: ["p1"],
        loadEntity,
        getProjectIdsFromEntity: () => ["p1"],
        requestFilterKey: "entityId",
        notFoundMessage: "Non trovato",
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Non trovato");
    expect(result.current.entity).toBeNull();
  });
});
