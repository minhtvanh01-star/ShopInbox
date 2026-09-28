import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/channel-sync-sweep", () => ({
  runChannelSyncSweep: vi.fn(),
}));

vi.mock("@/backend/platform-channel-sync", () => ({
  getChannelSyncSettings: vi.fn(),
  markChannelSyncRan: vi.fn(),
}));

import { runChannelSyncSweep } from "@/backend/channel-sync-sweep";
import { getChannelSyncSettings, markChannelSyncRan } from "@/backend/platform-channel-sync";
import { resetChannelSyncSchedule, runScheduledChannelSyncTick } from "./channel-sync-schedule";

describe("runScheduledChannelSyncTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CHANNEL_SYNC_ENABLED", "1");
    resetChannelSyncSchedule();
  });

  it("bỏ qua khi tắt", async () => {
    vi.mocked(getChannelSyncSettings).mockResolvedValue({
      enabled: false,
      intervalSec: 60,
      lastRunAt: null,
    });
    await expect(runScheduledChannelSyncTick()).resolves.toEqual({ skipped: true, reason: "disabled" });
    expect(runChannelSyncSweep).not.toHaveBeenCalled();
  });

  it("quét rồi ghi mốc khi đến hạn", async () => {
    vi.mocked(getChannelSyncSettings).mockResolvedValue({
      enabled: true,
      intervalSec: 60,
      lastRunAt: null,
    });
    vi.mocked(runChannelSyncSweep).mockResolvedValue({ channels: 1, ingested: 2, errors: 0 });
    vi.mocked(markChannelSyncRan).mockResolvedValue(undefined);

    await expect(runScheduledChannelSyncTick()).resolves.toEqual({
      channels: 1,
      ingested: 2,
      errors: 0,
    });
    expect(markChannelSyncRan).toHaveBeenCalled();
  });

  it("bỏ qua khi CHANNEL_SYNC_ENABLED=0", async () => {
    vi.stubEnv("CHANNEL_SYNC_ENABLED", "0");
    await expect(runScheduledChannelSyncTick()).resolves.toEqual({ skipped: true, reason: "env" });
    expect(getChannelSyncSettings).not.toHaveBeenCalled();
  });

  it("bỏ qua khi chưa đến hạn", async () => {
    vi.mocked(getChannelSyncSettings).mockResolvedValue({
      enabled: true,
      intervalSec: 60,
      lastRunAt: new Date(),
    });
    await expect(runScheduledChannelSyncTick()).resolves.toEqual({ skipped: true, reason: "not_due" });
    expect(runChannelSyncSweep).not.toHaveBeenCalled();
  });

  it("bỏ qua khi vòng trước còn chạy", async () => {
    vi.mocked(getChannelSyncSettings).mockResolvedValue({
      enabled: true,
      intervalSec: 60,
      lastRunAt: null,
    });
    vi.mocked(runChannelSyncSweep).mockResolvedValue({
      skipped: true,
      channels: 0,
      ingested: 0,
      errors: 0,
    });
    await expect(runScheduledChannelSyncTick()).resolves.toEqual({ skipped: true, reason: "overlap" });
    expect(markChannelSyncRan).not.toHaveBeenCalled();
  });

  it("dùng mốc bộ nhớ khi DB chưa ghi kịp", async () => {
    vi.mocked(getChannelSyncSettings).mockResolvedValue({
      enabled: true,
      intervalSec: 60,
      lastRunAt: null,
    });
    vi.mocked(runChannelSyncSweep).mockResolvedValue({ channels: 1, ingested: 1, errors: 0 });
    vi.mocked(markChannelSyncRan).mockResolvedValue(undefined);

    await runScheduledChannelSyncTick();
    await expect(runScheduledChannelSyncTick()).resolves.toEqual({ skipped: true, reason: "not_due" });
    expect(runChannelSyncSweep).toHaveBeenCalledTimes(1);
  });
});
