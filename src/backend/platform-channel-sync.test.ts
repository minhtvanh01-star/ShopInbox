import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    platformSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/backend/prisma";
import {
  getChannelSyncSettings,
  markChannelSyncRan,
  saveChannelSyncSettings,
} from "./platform-channel-sync";
import { DEFAULT_CHANNEL_SYNC_SETTINGS } from "@/lib/channel-sync";

describe("getChannelSyncSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trả mặc định khi chưa có dòng", async () => {
    vi.mocked(prisma.platformSetting.findUnique).mockResolvedValue(null);
    await expect(getChannelSyncSettings()).resolves.toEqual(DEFAULT_CHANNEL_SYNC_SETTINGS);
  });

  it("đọc bật/tắt và khoảng giây", async () => {
    const lastRunAt = new Date("2026-09-28T01:00:00.000Z");
    vi.mocked(prisma.platformSetting.findUnique).mockResolvedValue({
      id: "platform",
      channelSyncEnabled: false,
      channelSyncIntervalSec: 90,
      channelSyncLastRunAt: lastRunAt,
      updatedAt: lastRunAt,
    } as never);

    await expect(getChannelSyncSettings()).resolves.toEqual({
      enabled: false,
      intervalSec: 90,
      lastRunAt,
    });
  });

  it("trả mặc định khi DB chưa migrate", async () => {
    vi.mocked(prisma.platformSetting.findUnique).mockRejectedValue(
      new Error('relation "platform_settings" does not exist'),
    );
    await expect(getChannelSyncSettings()).resolves.toEqual(DEFAULT_CHANNEL_SYNC_SETTINGS);
  });
});

describe("saveChannelSyncSettings", () => {
  it("upsert khoảng đã kẹp", async () => {
    vi.mocked(prisma.platformSetting.upsert).mockResolvedValue({
      id: "platform",
      channelSyncEnabled: true,
      channelSyncIntervalSec: 15,
      channelSyncLastRunAt: null,
      updatedAt: new Date(),
    } as never);

    await saveChannelSyncSettings({ enabled: true, intervalSec: 5 });
    expect(prisma.platformSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ channelSyncIntervalSec: 15, channelSyncEnabled: true }),
        update: expect.objectContaining({ channelSyncIntervalSec: 15 }),
      }),
    );
  });
});

describe("markChannelSyncRan", () => {
  it("ghi mốc lần quét", async () => {
    vi.mocked(prisma.platformSetting.upsert).mockResolvedValue({} as never);
    const at = new Date("2026-09-28T02:00:00.000Z");
    await markChannelSyncRan(at);
    expect(prisma.platformSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { channelSyncLastRunAt: at },
      }),
    );
  });
});
