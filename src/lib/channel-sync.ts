/** Quét kéo tin kênh đã nối — Super admin đặt khoảng thời gian. */

export const PLATFORM_SETTING_ID = "platform";

export const CHANNEL_SYNC_MIN_SECONDS = 15;
export const CHANNEL_SYNC_MAX_SECONDS = 3600;
export const CHANNEL_SYNC_DEFAULT_SECONDS = 240;

export type ChannelSyncSettings = {
  enabled: boolean;
  intervalSec: number;
  lastRunAt: Date | null;
};

export const DEFAULT_CHANNEL_SYNC_SETTINGS: ChannelSyncSettings = {
  enabled: true,
  intervalSec: CHANNEL_SYNC_DEFAULT_SECONDS,
  lastRunAt: null,
};

export function clampChannelSyncIntervalSec(value: number) {
  if (!Number.isFinite(value)) return CHANNEL_SYNC_DEFAULT_SECONDS;
  return Math.min(
    CHANNEL_SYNC_MAX_SECONDS,
    Math.max(CHANNEL_SYNC_MIN_SECONDS, Math.round(value)),
  );
}

export function splitChannelSyncInterval(totalSec: number) {
  const clamped = clampChannelSyncIntervalSec(totalSec);
  return { minutes: Math.floor(clamped / 60), seconds: clamped % 60 };
}

export function normalizeChannelSyncInterval(minutes: unknown, seconds: unknown): number | null {
  const m = typeof minutes === "number" ? minutes : Number(minutes);
  const s = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
  const total = Math.round(m) * 60 + Math.round(s);
  if (total < CHANNEL_SYNC_MIN_SECONDS || total > CHANNEL_SYNC_MAX_SECONDS) return null;
  return total;
}

export function formatChannelSyncInterval(totalSec: number) {
  const { minutes, seconds } = splitChannelSyncInterval(totalSec);
  if (minutes > 0 && seconds > 0) return `${minutes} phút ${seconds} giây`;
  if (minutes > 0) return `${minutes} phút`;
  return `${seconds} giây`;
}

export function dueForChannelSync(input: {
  enabled: boolean;
  intervalSec: number;
  lastRunAt: Date | null;
  now?: Date;
}) {
  if (!input.enabled) return false;
  const last = input.lastRunAt?.getTime() ?? 0;
  const intervalMs = clampChannelSyncIntervalSec(input.intervalSec) * 1000;
  const nowMs = (input.now ?? new Date()).getTime();
  return nowMs - last >= intervalMs;
}

export function latestChannelSyncRunAt(db: Date | null | undefined, memory: Date | null | undefined) {
  const stamp = Math.max(db?.getTime() ?? 0, memory?.getTime() ?? 0);
  return stamp > 0 ? new Date(stamp) : null;
}

/** Tắt khẩn: CHANNEL_SYNC_ENABLED=0. Super admin vẫn chỉnh trong DB khi không tắt. */
export function shouldStartChannelSyncScheduler(
  env: NodeJS.ProcessEnv | { CHANNEL_SYNC_ENABLED?: string } = process.env,
) {
  return env.CHANNEL_SYNC_ENABLED !== "0";
}

export function channelSyncIntervalMs() {
  return CHANNEL_SYNC_DEFAULT_SECONDS * 1000;
}

export function shouldRunScheduledChannelSync(
  env: NodeJS.ProcessEnv | { CHANNEL_SYNC_ENABLED?: string } = process.env,
) {
  return shouldStartChannelSyncScheduler(env);
}
