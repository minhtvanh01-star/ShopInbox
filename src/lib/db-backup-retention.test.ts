import { describe, expect, it } from "vitest";
import {
  backupIntervalMs,
  backupKeepCount,
  backupsToDelete,
  shouldRunScheduledBackup,
} from "./db-backup-retention";

describe("backup retention", () => {
  it("keeps the newest files", () => {
    expect(
      backupsToDelete(
        ["shopinbox-20260901-010000.json", "shopinbox-20260902-010000.json", "readme.txt"],
        1,
      ),
    ).toEqual(["shopinbox-20260901-010000.json"]);
  });

  it("defaults keep / interval and production schedule", () => {
    expect(backupKeepCount("")).toBe(14);
    expect(backupIntervalMs("24")).toBe(24 * 60 * 60 * 1000);
    expect(shouldRunScheduledBackup({ NODE_ENV: "production" })).toBe(true);
    expect(shouldRunScheduledBackup({ NODE_ENV: "production", BACKUP_ENABLED: "0" })).toBe(false);
    expect(shouldRunScheduledBackup({ NODE_ENV: "development" })).toBe(false);
  });
});
