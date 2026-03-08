import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAsync } from "./useAsync";

describe("useAsync", () => {
  it("inizialmente data e error sono undefined/null e isLoading false", () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(1)));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("run risolve e aggiorna data", async () => {
    const { result } = renderHook(() => useAsync((x: number) => Promise.resolve(x + 1)));
    const runPromise = result.current.run(10);
    await waitFor(() => expect(result.current.data).toBe(11));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(await runPromise).toBe(11);
  });

  it("run rigetta e imposta error", async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject(new Error("fail")))
    );
    result.current.run();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.error).toBe("fail"));
    expect(result.current.data).toBeUndefined();
  });

  it("run rigetta con non-Error imposta Unknown error", async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject("string error"))
    );
    result.current.run();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Unknown error");
  });

  it("reset azzera data, error e isLoading", async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(1)));
    result.current.run();
    await waitFor(() => expect(result.current.data).toBe(1));
    result.current.reset();
    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("run prima resolve poi reject passa entrambi per finally (isLoading false)", async () => {
    const { result } = renderHook(() =>
      useAsync((ok: boolean) => (ok ? Promise.resolve(1) : Promise.reject(new Error("err"))))
    );
    const p1 = result.current.run(true);
    await waitFor(() => expect(result.current.data).toBe(1));
    expect(result.current.isLoading).toBe(false);
    await expect(p1).resolves.toBe(1);

    result.current.reset();
    result.current.run(false);
    await waitFor(() => expect(result.current.error).toBe("err"));
    expect(result.current.isLoading).toBe(false);
  });
});
