import { describe, expect, it } from "vitest";
import {
  CHANNEL_SYNC_DEFAULT_SECONDS,
  clampChannelSyncIntervalSec,
  dueForChannelSync,
  formatChannelSyncInterval,
  latestChannelSyncRunAt,
  normalizeChannelSyncInterval,
  shouldStartChannelSyncScheduler,
  splitChannelSyncInterval,
} from "./channel-sync";

describe("normalizeChannelSyncInterval", () => {
  it("ghép phút + giây, kẹp 15s–60 phút", () => {
    expect(normalizeChannelSyncInterval(4, 0)).toBe(CHANNEL_SYNC_DEFAULT_SECONDS);
    expect(normalizeChannelSyncInterval(0, 45)).toBe(45);
    expect(normalizeChannelSyncInterval(3, 30)).toBe(210);
    expect(normalizeChannelSyncInterval(0, 10)).toBeNull();
    expect(normalizeChannelSyncInterval(61, 0)).toBeNull();
    expect(normalizeChannelSyncInterval("x", 0)).toBeNull();
  });
});

describe("splitChannelSyncInterval", () => {
  it("tách phút/giây để hiện form", () => {
    expect(splitChannelSyncInterval(210)).toEqual({ minutes: 3, seconds: 30 });
    expect(splitChannelSyncInterval(45)).toEqual({ minutes: 0, seconds: 45 });
    expect(clampChannelSyncIntervalSec(5)).toBe(15);
  });
});

describe("formatChannelSyncInterval", () => {
  it("viết khoảng thời gian tiếng Việt", () => {
    expect(formatChannelSyncInterval(240)).toBe("4 phút");
    expect(formatChannelSyncInterval(45)).toBe("45 giây");
    expect(formatChannelSyncInterval(210)).toBe("3 phút 30 giây");
  });
});

describe("dueForChannelSync", () => {
  it("chưa đến hạn nếu vừa quét", () => {
    const now = new Date("2026-09-28T01:00:00.000Z");
    expect(
      dueForChannelSync({
        enabled: true,
        intervalSec: 60,
        lastRunAt: new Date("2026-09-28T00:59:30.000Z"),
        now,
      }),
    ).toBe(false);
    expect(
      dueForChannelSync({
        enabled: true,
        intervalSec: 60,
        lastRunAt: new Date("2026-09-28T00:58:00.000Z"),
        now,
      }),
    ).toBe(true);
    expect(
      dueForChannelSync({
        enabled: false,
        intervalSec: 15,
        lastRunAt: null,
        now,
      }),
    ).toBe(false);
  });
});

describe("latestChannelSyncRunAt", () => {
  it("lấy mốc mới hơn giữa DB và bộ nhớ", () => {
    const older = new Date("2026-09-28T01:00:00.000Z");
    const newer = new Date("2026-09-28T01:02:00.000Z");
    expect(latestChannelSyncRunAt(older, newer)?.toISOString()).toBe(newer.toISOString());
    expect(latestChannelSyncRunAt(null, null)).toBeNull();
  });
});

describe("shouldStartChannelSyncScheduler", () => {
  it("tắt khi CHANNEL_SYNC_ENABLED=0", () => {
    expect(shouldStartChannelSyncScheduler({})).toBe(true);
    expect(shouldStartChannelSyncScheduler({ CHANNEL_SYNC_ENABLED: "0" })).toBe(false);
    expect(shouldStartChannelSyncScheduler({ CHANNEL_SYNC_ENABLED: "1" })).toBe(true);
  });
});
