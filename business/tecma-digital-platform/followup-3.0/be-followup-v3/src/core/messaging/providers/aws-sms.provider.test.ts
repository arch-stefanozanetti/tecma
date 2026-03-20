import { describe, expect, it, vi } from "vitest";
import { AwsSmsProvider } from "./aws-sms.provider.js";

describe("AwsSmsProvider", () => {
  it("publishes sms and returns queued result", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "msg-1" });
    const provider = new AwsSmsProvider({ send } as never);

    const result = await provider.send({
      workspaceId: "w1",
      channel: "sms",
      to: "+393331112233",
      body: "hello",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("queued");
    expect(result.externalId).toBe("msg-1");
  });
});

