import "dotenv/config";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { backupKeepCount, backupsToDelete } from "@/lib/db-backup-retention";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  BACKUP_TABLES,
  BACKUP_VERSION,
  backupFileStamp,
  type BackupTable,
} from "@/backend/db-backup-plan";

export function createBackupPrisma(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("Thiếu DATABASE_URL. Copy .env.example thành .env hoặc truyền URL đích.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

type TableDelegate = {
  findMany: () => Promise<unknown[]>;
  deleteMany: () => Promise<unknown>;
  createMany: (args: { data: unknown[] }) => Promise<unknown>;
};

function asDelegate(model: object): TableDelegate {
  return model as TableDelegate;
}

function tableDelegates(prisma: PrismaClient): Record<BackupTable, TableDelegate> {
  return {
    shops: asDelegate(prisma.shop),
    roles: asDelegate(prisma.role),
    permissions: asDelegate(prisma.permission),
    rolePermissions: asDelegate(prisma.rolePermission),
    staff: asDelegate(prisma.staff),
    shopInvites: asDelegate(prisma.shopInvite),
    channelAccounts: asDelegate(prisma.channelAccount),
    customers: asDelegate(prisma.customer),
    customerIdentities: asDelegate(prisma.customerIdentity),
    productGroups: asDelegate(prisma.productGroup),
    products: asDelegate(prisma.product),
    productVariants: asDelegate(prisma.productVariant),
    conversations: asDelegate(prisma.conversation),
    messages: asDelegate(prisma.message),
    messageReactions: asDelegate(prisma.messageReaction),
    orders: asDelegate(prisma.order),
    orderItems: asDelegate(prisma.orderItem),
    orderChecklistTemplates: asDelegate(prisma.orderChecklistTemplate),
    orderChecklistChecks: asDelegate(prisma.orderChecklistCheck),
    quickReplies: asDelegate(prisma.quickReply),
    autoReplyRules: asDelegate(prisma.autoReplyRule),
    oauthPagePicks: asDelegate(prisma.oAuthPagePick),
    emailOtpChallenges: asDelegate(prisma.emailOtpChallenge),
    authLoginThrottles: asDelegate(prisma.authLoginThrottle),
    auditLogs: asDelegate(prisma.auditLog),
  };
}

export function resolveBackupDir(explicit?: string) {
  return explicit?.trim() || process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), "backups");
}

export async function dumpDatabase(prisma: PrismaClient) {
  const delegates = tableDelegates(prisma);
  const tables = {} as Record<BackupTable, unknown[]>;
  for (const table of BACKUP_TABLES) {
    tables[table] = await delegates[table].findMany();
  }
  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables,
  };
}

export async function writeBackupFile(
  payload: Awaited<ReturnType<typeof dumpDatabase>>,
  backupsDir = resolveBackupDir(),
) {
  await mkdir(backupsDir, { recursive: true });
  const filePath = path.join(backupsDir, `shopinbox-${backupFileStamp()}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

export async function pruneBackupDir(backupsDir = resolveBackupDir(), keep = backupKeepCount()) {
  const names = await readdir(backupsDir).catch(() => [] as string[]);
  const stale = backupsToDelete(names, keep);
  for (const name of stale) {
    await unlink(path.join(backupsDir, name)).catch(() => undefined);
  }
  return stale;
}

export async function restoreDatabase(
  prisma: PrismaClient,
  tables: Record<string, unknown[]>,
) {
  const delegates = tableDelegates(prisma);
  for (const table of [...BACKUP_TABLES].reverse()) {
    await delegates[table].deleteMany();
  }
  for (const table of BACKUP_TABLES) {
    const rows = tables[table] ?? [];
    if (rows.length === 0) {
      continue;
    }
    await delegates[table].createMany({ data: rows });
  }
}
