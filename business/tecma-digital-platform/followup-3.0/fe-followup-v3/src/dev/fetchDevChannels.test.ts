import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchDevChannels } from "./fetchDevChannels";

describe("fetchDevChannels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parsa array valido e scarta voci incomplete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: "a", gitBranch: "main", label: "Main", description: "d", basePath: "/app/a/" },
            { id: "", label: "x", basePath: "/" },
          ]),
          { status: 200 }
        )
      )
    );
    const list = await fetchDevChannels("/channels.json");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("a");
  });

  it("rifiuta risposta non-JSON array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    await expect(fetchDevChannels("/x")).rejects.toThrow("atteso array");
  });
});
