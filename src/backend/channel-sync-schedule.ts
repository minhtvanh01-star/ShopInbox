import { runChannelSyncSweep } from "@/backend/channel-sync-sweep";
import { getChannelSyncSettings, markChannelSyncRan } from "@/backend/platform-channel-sync";
import { dueForChannelSync, latestChannelSyncRunAt, shouldStartChannelSyncScheduler } from "@/lib/channel-sync";

const TICK_MS = 5_000;
const FIRST_DELAY_MS = 20_000;

let started = false;
let memoryLastRunAt: Date | null = null;

export function resetChannelSyncSchedule() {
  started = false;
  memoryLastRunAt = null;
}

export async function runScheduledChannelSyncTick() {
  if (!shouldStartChannelSyncScheduler()) {
    return { skipped: true as const, reason: "env" };
  }

  const settings = await getChannelSyncSettings();
  if (!settings.enabled) {
    return { skipped: true as const, reason: "disabled" };
  }
  const lastRunAt = latestChannelSyncRunAt(settings.lastRunAt, memoryLastRunAt);
  if (!dueForChannelSync({ ...settings, lastRunAt })) {
    return { skipped: true as const, reason: "not_due" };
  }

  const result = await runChannelSyncSweep();
  if (result.skipped) {
    return { skipped: true as const, reason: "overlap" };
  }

  memoryLastRunAt = new Date();
  await markChannelSyncRan(memoryLastRunAt);
  return result;
}

export function startScheduledChannelSync() {
  if (started || !shouldStartChannelSyncScheduler()) return;
  started = true;

  const tick = () => {
    void runScheduledChannelSyncTick()
      .then((result) => {
        if ("reason" in result && result.skipped) {
          if (result.reason === "overlap") {
            console.info("[channel-sync] skipped — vòng trước còn chạy");
          }
          return;
        }
        if ("channels" in result) {
          console.info(
            `[channel-sync] scanned channels=${result.channels} ingested=${result.ingested} errors=${result.errors}`,
          );
        }
      })
      .catch((error) => {
        console.error("[channel-sync] failed", error);
      });
  };

  setTimeout(tick, FIRST_DELAY_MS);
  setInterval(tick, TICK_MS);
  console.info("[channel-sync] scheduler on — Super admin đặt phút/giây trên Quản lý nền tảng");
}
