export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduledBackups } = await import("@/backend/db-backup-schedule");
  startScheduledBackups();
  try {
    const { ensureProductionData } = await import("@/backend/prod-bootstrap");
    await ensureProductionData();
  } catch (error) {
    console.error("[instrumentation] production data bootstrap failed", error);
  }
}
