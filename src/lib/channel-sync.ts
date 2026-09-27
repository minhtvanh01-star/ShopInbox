/** Quét kéo tin kênh đã nối — fallback khi webhook / live view chưa có. */

export const CHANNEL_SYNC_MIN_MINUTES = 3;
export const CHANNEL_SYNC_MAX_MINUTES = 5;
export const CHANNEL_SYNC_DEFAULT_MINUTES = 4;

export function channelSyncIntervalMinutes(raw = process.env.CHANNEL_SYNC_INTERVAL_MINUTES) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return CHANNEL_SYNC_DEFAULT_MINUTES;
  return Math.min(CHANNEL_SYNC_MAX_MINUTES, Math.max(CHANNEL_SYNC_MIN_MINUTES, Math.floor(n)));
}

export function channelSyncIntervalMs(raw = process.env.CHANNEL_SYNC_INTERVAL_MINUTES) {
  return channelSyncIntervalMinutes(raw) * 60 * 1000;
}

export function shouldRunScheduledChannelSync(env: {
  NODE_ENV?: string;
  CHANNEL_SYNC_ENABLED?: string;
} = process.env) {
  if (env.CHANNEL_SYNC_ENABLED === "0") return false;
  if (env.CHANNEL_SYNC_ENABLED === "1") return true;
  return env.NODE_ENV === "production";
}
