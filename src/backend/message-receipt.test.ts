import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: { findFirst: vi.fn(), findMany: vi.fn() },
    customerIdentity: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
    message: { updateMany: vi.fn() },
  },
}));

vi.mock("@/backend/prisma-errors", () => ({
  isMissingDbColumnError: vi.fn(() => false),
}));

import { applyMetaMessageWatermark } from "@/backend/message-sync";
import { prisma } from "@/backend/prisma";

describe("applyMetaMessageWatermark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channelAccount.findMany).mockResolvedValue([
      {
        id: "acc-1",
        shopId: "shop-1",
        channel: "facebook",
        pageId: "page-1",
        linkedPageId: "ig-business",
        oaId: null,
      },
    ] as never);
    vi.mocked(prisma.customerIdentity.findFirst).mockResolvedValue({
      customerId: "cust-1",
    } as never);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({
      id: "conv-1",
    } as never);
    vi.mocked(prisma.message.updateMany).mockResolvedValue({ count: 2 });
  });

  it("đánh dấu delivered theo watermark", async () => {
    const result = await applyMetaMessageWatermark({
      channel: "facebook",
      externalAccountId: "page-1",
      customerExternalId: "psid-1",
      watermarkMs: 1_700_000_000_000,
      kind: "delivered",
      mids: ["mid.1"],
    });

    expect(result).toEqual({ ok: true, updated: 4 });
    expect(prisma.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: "conv-1",
          sender: "shop",
          deliveredAt: null,
        }),
        data: { deliveredAt: new Date(1_700_000_000_000) },
      }),
    );
  });

  it("read cũng set delivered nếu còn thiếu", async () => {
    vi.mocked(prisma.message.updateMany).mockResolvedValue({ count: 1 });

    const result = await applyMetaMessageWatermark({
      channel: "facebook",
      externalAccountId: "page-1",
      customerExternalId: "psid-1",
      watermarkMs: 1_700_000_000_000,
      kind: "read",
    });

    expect(result.ok).toBe(true);
    expect(prisma.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { readAt: new Date(1_700_000_000_000) },
      }),
    );
    expect(prisma.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deliveredAt: new Date(1_700_000_000_000) },
      }),
    );
  });

  it("bỏ qua watermark không hợp lệ", async () => {
    const result = await applyMetaMessageWatermark({
      channel: "facebook",
      externalAccountId: "page-1",
      customerExternalId: "psid-1",
      watermarkMs: 0,
      kind: "delivered",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_watermark", updated: 0 });
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  it("bỏ qua khi reader là chính Page (self-echo)", async () => {
    const result = await applyMetaMessageWatermark({
      channel: "facebook",
      externalAccountId: "page-1",
      customerExternalId: "page-1",
      watermarkMs: 1_700_000_000_000,
      kind: "read",
    });
    expect(result).toEqual({ ok: false, reason: "page_as_reader", updated: 0 });
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  it("bỏ qua khi reader trùng linkedPageId / pageId của tài khoản", async () => {
    const result = await applyMetaMessageWatermark({
      channel: "instagram",
      externalAccountId: "ig-business",
      customerExternalId: "page-1",
      watermarkMs: 1_700_000_000_000,
      kind: "read",
    });
    expect(result).toEqual({ ok: false, reason: "page_as_reader", updated: 0 });
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });
});
