import { readFile } from "node:fs/promises";
import path from "node:path";
import { isBackupPayload } from "../src/backend/db-backup-plan";
import { createBackupPrisma, restoreDatabase } from "../src/backend/db-backup-io";

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const file = argv.find((arg) => !arg.startsWith("--"));
  return { force, file };
}

async function main() {
  const { force, file } = parseArgs(process.argv.slice(2));
  if (!force) {
    throw new Error("Restore sẽ ghi đè DB. Chạy lại với --force, ví dụ: npm run db:restore -- --force backups/file.json");
  }
  if (!file) {
    throw new Error("Thiếu file backup. Ví dụ: npm run db:restore -- --force backups/shopinbox-20260815-091300.json");
  }

  const raw = JSON.parse(await readFile(path.resolve(file), "utf8")) as unknown;
  if (!isBackupPayload(raw)) {
    throw new Error("File backup không hợp lệ (cần version 1 và tables).");
  }

  const prisma = createBackupPrisma();
  try {
    await restoreDatabase(prisma, raw.tables);
    console.log(`Đã restore ${file} lên DATABASE_URL.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
