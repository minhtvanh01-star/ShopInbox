import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/backend/message-sync", () => ({
  ingestInboundMessage: vi.fn(),
  touchChannelWebhook: vi.fn(),
}));

import { ingestInboundMessage, touchChannelWebhook } from "@/backend/message-sync";
import { processMetaWebhook } from "@/backend/webhook-meta";

describe("processMetaWebhook", () => {
  beforeEach(() => {
    vi.mocked(touchChannelWebhook).mockResolvedValue(undefined);
    vi.mocked(ingestInboundMessage).mockResolvedValue({
      ok: true,
      duplicate: false,
      conversationId: "conv-test",
      shopId: "shop1",
    });
  });

  it("bỏ qua echo message", async () => {
    const result = await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "page-1",
          messaging: [
            {
              sender: { id: "user-1" },
              message: { mid: "m1", text: "hello", is_echo: true },
            },
          ],
        },
      ],
    });

    expect(result.processed).toBe(0);
    expect(ingestInboundMessage).not.toHaveBeenCalled();
  });

  it("xử lý tin nhắn text inbound", async () => {
    const result = await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "page-1",
          messaging: [
            {
              sender: { id: "user-1" },
              timestamp: 1_700_000_000_000,
              message: { mid: "m2", text: "Xin chào shop" },
            },
          ],
        },
      ],
    });

    expect(result.processed).toBe(1);
    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "facebook",
        externalAccountId: "page-1",
        senderExternalId: "user-1",
        text: "Xin chào shop",
        externalMessageId: "m2",
      }),
    );
  });

  it("xử lý postback", async () => {
    await processMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "ig-1",
          messaging: [
            {
              sender: { id: "user-2" },
              postback: { mid: "p1", title: "Bắt đầu chat" },
            },
          ],
        },
      ],
    });

    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "instagram",
        text: "[Postback] Bắt đầu chat",
      }),
    );
  });
});
