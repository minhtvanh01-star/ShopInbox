import {
  createBackupPrisma,
  dumpDatabase,
  pruneBackupDir,
  resolveBackupDir,
  writeBackupFile,
} from "@/backend/db-backup-io";

export async function runDatabaseBackup() {
  const prisma = createBackupPrisma();
  const dir = resolveBackupDir();
  try {
    const payload = await dumpDatabase(prisma);
    const filePath = await writeBackupFile(payload, dir);
    const pruned = await pruneBackupDir(dir);
    const rowCount = Object.values(payload.tables).reduce((sum, rows) => sum + rows.length, 0);
    return { filePath, pruned, rowCount, createdAt: payload.createdAt };
  } finally {
    await prisma.$disconnect();
  }
}
