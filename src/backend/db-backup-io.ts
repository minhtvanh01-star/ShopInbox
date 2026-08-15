import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
    channelAccounts: asDelegate(prisma.channelAccount),
    customers: asDelegate(prisma.customer),
    customerIdentities: asDelegate(prisma.customerIdentity),
    products: asDelegate(prisma.product),
    conversations: asDelegate(prisma.conversation),
    messages: asDelegate(prisma.message),
    orders: asDelegate(prisma.order),
    orderItems: asDelegate(prisma.orderItem),
    quickReplies: asDelegate(prisma.quickReply),
    auditLogs: asDelegate(prisma.auditLog),
  };
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
  backupsDir = path.join(process.cwd(), "backups"),
) {
  await mkdir(backupsDir, { recursive: true });
  const filePath = path.join(backupsDir, `shopinbox-${backupFileStamp()}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
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
