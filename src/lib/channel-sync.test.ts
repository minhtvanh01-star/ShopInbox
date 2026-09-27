import { describe, expect, it } from "vitest";
import {
  CHANNEL_SYNC_DEFAULT_MINUTES,
  channelSyncIntervalMinutes,
  channelSyncIntervalMs,
  shouldRunScheduledChannelSync,
} from "./channel-sync";

describe("channelSyncIntervalMinutes", () => {
  it("mặc định 4 phút, kẹp 3–5", () => {
    expect(channelSyncIntervalMinutes(undefined)).toBe(CHANNEL_SYNC_DEFAULT_MINUTES);
    expect(channelSyncIntervalMinutes("2")).toBe(3);
    expect(channelSyncIntervalMinutes("5")).toBe(5);
    expect(channelSyncIntervalMinutes("9")).toBe(5);
    expect(channelSyncIntervalMs("4")).toBe(4 * 60 * 1000);
  });
});

describe("shouldRunScheduledChannelSync", () => {
  it("bật production, tắt khi CHANNEL_SYNC_ENABLED=0", () => {
    expect(shouldRunScheduledChannelSync({ NODE_ENV: "production" })).toBe(true);
    expect(shouldRunScheduledChannelSync({ NODE_ENV: "development" })).toBe(false);
    expect(shouldRunScheduledChannelSync({ NODE_ENV: "development", CHANNEL_SYNC_ENABLED: "1" })).toBe(
      true,
    );
    expect(shouldRunScheduledChannelSync({ NODE_ENV: "production", CHANNEL_SYNC_ENABLED: "0" })).toBe(
      false,
    );
  });
});
