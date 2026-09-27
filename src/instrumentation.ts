export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduledBackups } = await import("@/backend/db-backup-schedule");
  startScheduledBackups();
  try {
    const { ensureDatabaseReady } = await import("@/backend/prod-bootstrap");
    await ensureDatabaseReady();
  } catch (error) {
    console.error("[instrumentation] database ready failed", error);
  }
}
