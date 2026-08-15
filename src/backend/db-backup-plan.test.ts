import { describe, expect, it } from "vitest";
import {
  BACKUP_TABLES,
  BACKUP_VERSION,
  backupFileStamp,
  isBackupPayload,
} from "@/backend/db-backup-plan";

describe("db backup plan", () => {
  it("restores parent tables before children", () => {
    const order = [...BACKUP_TABLES];
    expect(order.indexOf("shops")).toBeLessThan(order.indexOf("staff"));
    expect(order.indexOf("staff")).toBeLessThan(order.indexOf("conversations"));
    expect(order.indexOf("customers")).toBeLessThan(order.indexOf("orders"));
    expect(order.indexOf("orders")).toBeLessThan(order.indexOf("orderItems"));
    expect(order.indexOf("conversations")).toBeLessThan(order.indexOf("messages"));
  });

  it("builds a Windows-safe backup filename stamp", () => {
    expect(backupFileStamp(new Date(2026, 7, 15, 9, 13, 5))).toBe("20260815-091305");
  });

  it("accepts versioned backup payloads only", () => {
    expect(isBackupPayload({ version: BACKUP_VERSION, tables: { shops: [] } })).toBe(true);
    expect(isBackupPayload({ version: 0, tables: {} })).toBe(false);
    expect(isBackupPayload(null)).toBe(false);
  });
});
