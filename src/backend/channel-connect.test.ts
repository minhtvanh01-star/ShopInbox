import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/backend/meta-oauth", () => ({
  subscribeMetaPageWebhook: vi.fn(),
}));

import { prisma } from "@/backend/prisma";
import { markChannelConnecting } from "@/backend/channel-connect";

describe("markChannelConnecting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates existing channel account to connecting", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue({
      id: "ch-facebook",
    } as never);
    vi.mocked(prisma.channelAccount.update).mockResolvedValue({} as never);

    await expect(markChannelConnecting("shop1", "facebook")).resolves.toBe("ch-facebook");

    expect(prisma.channelAccount.update).toHaveBeenCalledWith({
      where: { id: "ch-facebook" },
      data: {
        status: "connecting",
        note: "Đang chờ hoàn tất OAuth...",
      },
    });
    expect(prisma.channelAccount.create).not.toHaveBeenCalled();
  });

  it("creates draft channel account when shop has no row yet", async () => {
    vi.mocked(prisma.channelAccount.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.channelAccount.create).mockResolvedValue({
      id: "ch-facebook-new",
    } as never);

    await expect(markChannelConnecting("shop1", "facebook")).resolves.toBe("ch-facebook-new");

    expect(prisma.channelAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shopId: "shop1",
        channel: "facebook",
        name: "Facebook Messenger",
        status: "connecting",
        note: "Đang chờ hoàn tất OAuth...",
      }),
    });
  });
});
