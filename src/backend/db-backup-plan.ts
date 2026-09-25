/** Thứ tự restore: bảng cha trước, bảng con sau. */
export const BACKUP_TABLES = [
  "shops",
  "roles",
  "permissions",
  "rolePermissions",
  "staff",
  "channelAccounts",
  "customers",
  "customerIdentities",
  "productGroups",
  "products",
  "productVariants",
  "conversations",
  "messages",
  "messageReactions",
  "orders",
  "orderItems",
  "orderChecklistTemplates",
  "orderChecklistChecks",
  "quickReplies",
  "autoReplyRules",
  "oauthPagePicks",
  "emailOtpChallenges",
  "authLoginThrottles",
  "auditLogs",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_VERSION = 1;

export function backupFileStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function isBackupPayload(value: unknown): value is {
  version: number;
  tables: Record<string, unknown[]>;
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as { version?: unknown; tables?: unknown };
  return payload.version === BACKUP_VERSION && Boolean(payload.tables) && typeof payload.tables === "object";
}
