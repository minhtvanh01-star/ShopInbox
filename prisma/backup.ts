import {
  createBackupPrisma,
  dumpDatabase,
  pruneBackupDir,
  writeBackupFile,
} from "../src/backend/db-backup-io";

async function main() {
  const prisma = createBackupPrisma();
  try {
    const payload = await dumpDatabase(prisma);
    const filePath = await writeBackupFile(payload);
    await pruneBackupDir();
    const counts = Object.entries(payload.tables).map(
      ([table, rows]) => `${table}:${rows.length}`,
    );
    console.log(`Đã backup DB → ${filePath}`);
    console.log(counts.join(" "));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
