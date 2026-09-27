import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: {
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/backend/prisma";
import { processShopifyWebhook } from "@/backend/webhook-shopify";

describe("processShopifyWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disconnects the shop on app/uninstalled", async () => {
    vi.mocked(prisma.channelAccount.updateMany).mockResolvedValue({ count: 1 } as never);
    await expect(
      processShopifyWebhook({ topic: "app/uninstalled", shopDomain: "Cuahang.myshopify.com" }),
    ).resolves.toEqual({ handled: true });
    expect(prisma.channelAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channel: "shopify", pageId: "cuahang.myshopify.com" },
      }),
    );
  });

  it("acknowledges GDPR topics without writing PII", async () => {
    await expect(
      processShopifyWebhook({ topic: "customers/redact", shopDomain: "cuahang.myshopify.com" }),
    ).resolves.toEqual({ handled: true });
    expect(prisma.channelAccount.updateMany).not.toHaveBeenCalled();
  });
});
