export const BACKUP_FILE_RE = /^shopinbox-\d{8}-\d{6}\.json$/;
export const DEFAULT_BACKUP_KEEP = 14;

export function backupKeepCount(raw = process.env.BACKUP_KEEP) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_BACKUP_KEEP;
  return Math.min(90, Math.floor(n));
}

export function backupsToDelete(fileNames: string[], keep = backupKeepCount()) {
  const matched = fileNames.filter((name) => BACKUP_FILE_RE.test(name)).sort();
  if (matched.length <= keep) return [];
  return matched.slice(0, matched.length - keep);
}

export function shouldRunScheduledBackup(env: {
  NODE_ENV?: string;
  BACKUP_ENABLED?: string;
} = process.env) {
  if (env.BACKUP_ENABLED === "0") return false;
  if (env.BACKUP_ENABLED === "1") return true;
  return env.NODE_ENV === "production";
}

export function backupIntervalMs(rawHours = process.env.BACKUP_INTERVAL_HOURS) {
  const hours = Number(rawHours);
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return Math.max(1, safe) * 60 * 60 * 1000;
}
