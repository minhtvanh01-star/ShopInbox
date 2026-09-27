import { runChannelSyncSweep } from "@/backend/channel-sync-sweep";
import { channelSyncIntervalMs, shouldRunScheduledChannelSync } from "@/lib/channel-sync";

let started = false;

export function startScheduledChannelSync() {
  if (started || !shouldRunScheduledChannelSync()) return;
  started = true;

  const intervalMs = channelSyncIntervalMs();
  const firstDelayMs = 45_000;

  const tick = () => {
    void runChannelSyncSweep()
      .then((result) => {
        if (result.skipped) {
          console.info("[channel-sync] skipped — vòng trước còn chạy");
          return;
        }
        console.info(
          `[channel-sync] scanned channels=${result.channels} ingested=${result.ingested} errors=${result.errors}`,
        );
      })
      .catch((error) => {
        console.error("[channel-sync] failed", error);
      });
  };

  setTimeout(tick, firstDelayMs);
  setInterval(tick, intervalMs);
  console.info(
    `[channel-sync] scheduler on — first run in ${firstDelayMs / 1000}s, then every ${intervalMs / 60000}m`,
  );
}
