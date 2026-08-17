import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/backend/message-sync", () => ({
  ingestInboundMessage: vi.fn(),
  touchChannelWebhook: vi.fn(),
  upsertMessageReaction: vi.fn(),
  removeMessageReaction: vi.fn(),
  applyMetaMessageWatermark: vi.fn(),
}));

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: { findFirst: vi.fn() },
    message: { findFirst: vi.fn() },
  },
}));

import {
  applyMetaMessageWatermark,
  ingestInboundMessage,
  touchChannelWebhook,
} from "@/backend/message-sync";
import {
  isMetaReceiptFromPage,
  processMetaWebhook,
  resolveMetaExternalAccountId,
} from "@/backend/webhook-meta";

describe("resolveMetaExternalAccountId", () => {
  it("ưu tiên recipient thật, bỏ entry id placeholder 0", () => {
    expect(resolveMetaExternalAccountId("0", "page-real")).toBe("page-real");
    expect(resolveMetaExternalAccountId("page-1", "page-1")).toBe("page-1");
    expect(resolveMetaExternalAccountId("page-1")).toBe("page-1");
  });
});

describe("isMetaReceiptFromPage", () => {
  it("cho phép read từ khách (PSID ≠ Page)", () => {
    expect(
      isMetaReceiptFromPage({
        senderId: "user-1",
        recipientId: "page-1",
        entryId: "page-1",
      }),
    ).toBe(false);
  });

  it("bỏ qua khi sender là Page / self-echo", () => {
    expect(
      isMetaReceiptFromPage({
        senderId: "page-1",
        recipientId: "user-1",
        entryId: "page-1",
      }),
    ).toBe(true);
    expect(
      isMetaReceiptFromPage({
        senderId: "page-1",
        recipientId: "page-1",
        entryId: "page-1",
      }),
    ).toBe(true);
  });
});

describe("processMetaWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(touchChannelWebhook).mockResolvedValue(1);
    vi.mocked(ingestInboundMessage).mockResolvedValue({
      ok: true,
      duplicate: false,
      conversationId: "conv-test",
      shopId: "shop1",
    });
    vi.mocked(applyMetaMessageWatermark).mockResolvedValue({ ok: true, updated: 1 });
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

  it("Meta test entry.id=0 dùng recipient.id để khớp Page", async () => {
    await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "0",
          messaging: [
            {
              sender: { id: "user-1" },
              recipient: { id: "page-real" },
              message: { mid: "m-test", text: "hello test" },
            },
          ],
        },
      ],
    });

    expect(touchChannelWebhook).toHaveBeenCalledWith("facebook", "page-real");
    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        externalAccountId: "page-real",
        text: "hello test",
      }),
    );
  });

  it("nhận payload changes.field=messages từ dashboard test", async () => {
    await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "0",
          changes: [
            {
              field: "messages",
              value: {
                sender: { id: "user-9" },
                recipient: { id: "page-real" },
                message: { mid: "m-change", text: "từ changes" },
              },
            },
          ],
        },
      ],
    });

    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        externalAccountId: "page-real",
        senderExternalId: "user-9",
        text: "từ changes",
        externalMessageId: "m-change",
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

  it("nhận ảnh inbound từ attachments", async () => {
    await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "page-1",
          messaging: [
            {
              sender: { id: "user-1" },
              recipient: { id: "page-1" },
              message: {
                mid: "m-img",
                attachments: [
                  {
                    type: "image",
                    payload: { url: "https://cdn.example/a.jpg" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "[Ảnh]",
        attachmentType: "image",
        attachmentUrl: "https://cdn.example/a.jpg",
        externalMessageId: "m-img",
      }),
    );
  });

  it("xử lý message_deliveries watermark", async () => {
    const result = await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "page-1",
          messaging: [
            {
              sender: { id: "user-1" },
              recipient: { id: "page-1" },
              timestamp: 1_700_000_100_000,
              delivery: {
                mids: ["mid.abc"],
                watermark: 1_700_000_100_000,
              },
            },
          ],
        },
      ],
    });

    expect(result.processed).toBe(1);
    expect(applyMetaMessageWatermark).toHaveBeenCalledWith({
      channel: "facebook",
      externalAccountId: "page-1",
      customerExternalId: "user-1",
      watermarkMs: 1_700_000_100_000,
      kind: "delivered",
      mids: ["mid.abc"],
    });
    expect(ingestInboundMessage).not.toHaveBeenCalled();
  });

  it("xử lý message_reads watermark", async () => {
    const result = await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "page-1",
          messaging: [
            {
              sender: { id: "user-1" },
              recipient: { id: "page-1" },
              read: { watermark: 1_700_000_200_000 },
            },
          ],
        },
      ],
    });

    expect(result.processed).toBe(1);
    expect(applyMetaMessageWatermark).toHaveBeenCalledWith({
      channel: "facebook",
      externalAccountId: "page-1",
      customerExternalId: "user-1",
      watermarkMs: 1_700_000_200_000,
      kind: "read",
    });
  });

  it("nhận delivery từ changes.field=message_deliveries", async () => {
    await processMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "ig-1",
          changes: [
            {
              field: "message_deliveries",
              value: {
                sender: { id: "ig-user" },
                recipient: { id: "ig-1" },
                watermark: 1_700_000_300_000,
                mids: ["mid.ig"],
              },
            },
          ],
        },
      ],
    });

    expect(applyMetaMessageWatermark).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "instagram",
        externalAccountId: "ig-1",
        customerExternalId: "ig-user",
        watermarkMs: 1_700_000_300_000,
        kind: "delivered",
        mids: ["mid.ig"],
      }),
    );
  });

  it("bỏ qua read echo từ Page (không đánh dấu tin shop đã xem)", async () => {
    const result = await processMetaWebhook({
      object: "page",
      entry: [
        {
          id: "page-1",
          messaging: [
            {
              sender: { id: "page-1" },
              recipient: { id: "user-1" },
              read: { watermark: 1_700_000_200_000 },
            },
          ],
        },
      ],
    });

    expect(result.processed).toBe(0);
    expect(applyMetaMessageWatermark).not.toHaveBeenCalled();
  });

  it("nhận Instagram messaging_seen như read watermark", async () => {
    await processMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "ig-1",
          changes: [
            {
              field: "messaging_seen",
              value: {
                sender: { id: "ig-user" },
                recipient: { id: "ig-1" },
                watermark: 1_700_000_400_000,
              },
            },
          ],
        },
      ],
    });

    expect(applyMetaMessageWatermark).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "instagram",
        customerExternalId: "ig-user",
        watermarkMs: 1_700_000_400_000,
        kind: "read",
      }),
    );
  });
});
