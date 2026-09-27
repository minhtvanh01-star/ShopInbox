import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { resolveDatabaseUrl } from "@/lib/database-url";

const execFileAsync = promisify(execFile);

export function prismaMigrateDeployCommand(
  cwd = process.cwd(),
  platform = process.platform,
) {
  const local = path.join(
    cwd,
    "node_modules",
    ".bin",
    platform === "win32" ? "prisma.cmd" : "prisma",
  );
  if (existsSync(local)) {
    return { file: local, args: ["migrate", "deploy"] };
  }
  return { file: "npx", args: ["prisma", "migrate", "deploy"] };
}

/** VibeHost hay gọi `next start` — migrate không chạy. Gọi lúc boot. */
export async function deployPendingMigrations(
  env: Record<string, string | undefined> = process.env,
) {
  const url = resolveDatabaseUrl(env);
  if (!url) {
    console.error("[migrate] skip — no usable DATABASE_URL / DB_URI");
    return { ok: false as const, reason: "missing_url" };
  }

  const { file, args } = prismaMigrateDeployCommand();
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env, DATABASE_URL: url },
      timeout: 60_000,
    });
    if (stdout.trim()) console.info("[migrate] deploy", stdout.trim());
    if (stderr.trim()) console.error("[migrate] deploy stderr", stderr.trim());
    return { ok: true as const };
  } catch (error) {
    console.error("[migrate] deploy failed", error);
    return { ok: false as const, reason: "deploy_failed" };
  }
}
