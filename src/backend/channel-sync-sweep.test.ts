import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    channelAccount: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/backend/channel-connect", () => ({
  syncConnectedMetaInbox: vi.fn(),
}));

import { prisma } from "@/backend/prisma";
import { syncConnectedMetaInbox } from "@/backend/channel-connect";
import { resetChannelSyncSweepLock, runChannelSyncSweep } from "./channel-sync-sweep";

describe("runChannelSyncSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChannelSyncSweepLock();
  });

  it("kéo một vòng mọi kênh FB/IG đã nối, không đăng ký webhook", async () => {
    vi.mocked(prisma.channelAccount.findMany).mockResolvedValue([
      { shopId: "shop1", channel: "facebook" },
      { shopId: "shop1", channel: "instagram" },
    ] as never);
    vi.mocked(syncConnectedMetaInbox)
      .mockResolvedValueOnce({ ingested: 2, webhookNote: "" })
      .mockResolvedValueOnce({ ingested: 0, webhookNote: "" });

    await expect(runChannelSyncSweep()).resolves.toEqual({
      channels: 2,
      ingested: 2,
      errors: 0,
    });
    expect(syncConnectedMetaInbox).toHaveBeenCalledTimes(2);
    expect(syncConnectedMetaInbox).toHaveBeenNthCalledWith(1, "shop1", "facebook", {
      registerWebhooks: false,
      updateNote: false,
    });
  });

  it("lọc theo shop khi admin bấm đồng bộ", async () => {
    vi.mocked(prisma.channelAccount.findMany).mockResolvedValue([
      { shopId: "shop1", channel: "facebook" },
    ] as never);
    vi.mocked(syncConnectedMetaInbox).mockResolvedValue({ ingested: 1, webhookNote: "" });

    await runChannelSyncSweep("shop1");
    expect(prisma.channelAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shopId: "shop1" }),
      }),
    );
  });

  it("lỗi một kênh không dừng vòng quét", async () => {
    vi.mocked(prisma.channelAccount.findMany).mockResolvedValue([
      { shopId: "a", channel: "facebook" },
      { shopId: "b", channel: "facebook" },
    ] as never);
    vi.mocked(syncConnectedMetaInbox)
      .mockRejectedValueOnce(new Error("Graph"))
      .mockResolvedValueOnce({ ingested: 3, webhookNote: "" });

    await expect(runChannelSyncSweep()).resolves.toEqual({
      channels: 2,
      ingested: 3,
      errors: 1,
    });
  });

  it("bỏ qua nếu vòng trước chưa xong", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(prisma.channelAccount.findMany).mockImplementation((async () => {
      await blocked;
      return [];
    }) as never);

    const first = runChannelSyncSweep();
    await expect(runChannelSyncSweep()).resolves.toEqual({
      skipped: true,
      channels: 0,
      ingested: 0,
      errors: 0,
    });
    release();
    await first;
  });
});
