export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduledBackups } = await import("@/backend/db-backup-schedule");
  startScheduledBackups();
}
