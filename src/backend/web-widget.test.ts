import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    customerIdentity: {
      findFirst: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/backend/message-sync", () => ({
  ingestInboundMessage: vi.fn(),
}));

import { prisma } from "@/backend/prisma";
import { ingestInboundMessage } from "@/backend/message-sync";
import { resetWebWidgetRateLimitForTests } from "@/backend/web-widget-rate";
import {
  ingestWebWidgetMessage,
  listWebWidgetShopReplies,
  rotateWebWidgetKey,
} from "@/backend/web-widget";

const readyAccount = {
  id: "ch-web",
  shopId: "shop1",
  pageId: "https://shop.vn",
  webhookSecret: "siwk_testkey",
};

describe("web widget backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWebWidgetRateLimitForTests();
  });

  it("rejects a missing key", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(null);
    await expect(
      ingestWebWidgetMessage({
        key: "",
        origin: "https://shop.vn",
        visitorId: "si_abcdefghijklmnop",
        text: "hello",
      }),
    ).resolves.toMatchObject({ ok: false, error: "unauthorized", status: 401 });
  });

  it("allows the ShopInbox app origin for in-app preview", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.shopinbox.test";
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(readyAccount as never);
    vi.mocked(ingestInboundMessage).mockResolvedValue({
      ok: true,
      conversationId: "c1",
      duplicate: false,
    } as never);

    await expect(
      ingestWebWidgetMessage({
        key: "siwk_testkey",
        origin: "https://app.shopinbox.test",
        visitorId: "si_abcdefghijklmnop",
        text: "preview",
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("rejects a foreign origin", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(readyAccount as never);
    await expect(
      ingestWebWidgetMessage({
        key: "siwk_testkey",
        origin: "https://evil.example",
        visitorId: "si_abcdefghijklmnop",
        text: "hello",
      }),
    ).resolves.toMatchObject({ ok: false, error: "origin", status: 403 });
    expect(ingestInboundMessage).not.toHaveBeenCalled();
  });

  it("ingests a valid visitor message", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(readyAccount as never);
    vi.mocked(ingestInboundMessage).mockResolvedValue({
      ok: true,
      conversationId: "c1",
      duplicate: false,
    } as never);

    await expect(
      ingestWebWidgetMessage({
        key: "siwk_testkey",
        origin: "https://shop.vn",
        visitorId: "si_abcdefghijklmnop",
        text: "xin chào",
        externalMessageId: "si_abcdefghijklmnop-1",
      }),
    ).resolves.toMatchObject({ ok: true, duplicate: false });

    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "web",
        senderExternalId: "si_abcdefghijklmnop",
        text: "xin chào",
        externalMessageId: "si_abcdefghijklmnop-1",
      }),
    );
  });

  it("returns shop replies after a timestamp", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(readyAccount as never);
    vi.mocked(prisma.customerIdentity.findFirst).mockResolvedValue({ customerId: "cust1" } as never);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "conv1" } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([
      { id: "m1", text: "shop hello", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    ] as never);

    const result = await listWebWidgetShopReplies({
      key: "siwk_testkey",
      origin: "https://shop.vn",
      visitorId: "si_abcdefghijklmnop",
      after: "2025-12-31T00:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      messages: [{ id: "m1", text: "shop hello", createdAt: "2026-01-01T00:00:00.000Z" }],
    });
  });

  it("rate-limits a 21st inbound message", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(readyAccount as never);
    vi.mocked(ingestInboundMessage).mockResolvedValue({
      ok: true,
      conversationId: "c1",
      duplicate: false,
    } as never);

    for (let i = 0; i < 20; i += 1) {
      const result = await ingestWebWidgetMessage({
        key: "siwk_testkey",
        origin: "https://shop.vn",
        ip: "203.0.113.9",
        visitorId: "si_abcdefghijklmnop",
        text: `msg ${i}`,
      });
      expect(result.ok).toBe(true);
    }

    await expect(
      ingestWebWidgetMessage({
        key: "siwk_testkey",
        origin: "https://shop.vn",
        ip: "203.0.113.9",
        visitorId: "si_abcdefghijklmnop",
        text: "one more",
      }),
    ).resolves.toMatchObject({ ok: false, error: "rate_limited", status: 429 });
  });

  it("rotates the widget key only when ready", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-web",
      status: "disconnected",
    } as never);
    await expect(rotateWebWidgetKey("shop1")).resolves.toMatchObject({ ok: false });

    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-web",
      status: "ready",
    } as never);
    vi.mocked(prisma.channelAccount.update).mockResolvedValue({} as never);
    const rotated = await rotateWebWidgetKey("shop1");
    expect(rotated.ok).toBe(true);
    if (rotated.ok) {
      expect(rotated.key.startsWith("siwk_")).toBe(true);
    }
  });
});
