import { runDatabaseBackup } from "@/backend/db-backup-job";
import { backupIntervalMs, shouldRunScheduledBackup } from "@/lib/db-backup-retention";

let started = false;

export function startScheduledBackups() {
  if (started || !shouldRunScheduledBackup()) return;
  started = true;

  const intervalMs = backupIntervalMs();
  const firstDelayMs = 20_000;

  const tick = () => {
    void runDatabaseBackup()
      .then((result) => {
        console.info("[backup] wrote", result.filePath, `rows=${result.rowCount}`);
      })
      .catch((error) => {
        console.error("[backup] failed", error);
      });
  };

  setTimeout(tick, firstDelayMs);
  setInterval(tick, intervalMs);
  console.info(
    `[backup] scheduler on — first run in ${firstDelayMs / 1000}s, then every ${intervalMs / 3600000}h`,
  );
}
