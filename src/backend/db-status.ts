import { prisma } from "@/backend/prisma";
import {
  classifyDatabaseError,
  inspectDatabaseUrl,
  type DatabaseErrorCode,
  type DatabaseUrlKind,
} from "@/lib/database-url";

export type DatabaseProbe =
  | { ok: true; hostKind: DatabaseUrlKind; code: "ok" }
  | { ok: false; hostKind: DatabaseUrlKind; code: DatabaseErrorCode };

export async function probeDatabase(
  env: Record<string, string | undefined> = process.env,
): Promise<DatabaseProbe> {
  const info = inspectDatabaseUrl(env.DATABASE_URL);
  if (info.kind === "unset") return { ok: false, hostKind: "unset", code: "missing_url" };
  if (info.kind === "invalid") return { ok: false, hostKind: "invalid", code: "invalid_url" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, hostKind: info.kind, code: "ok" };
  } catch (error) {
    let code = classifyDatabaseError(error);
    if (
      env.NODE_ENV === "production" &&
      info.kind === "loopback" &&
      code !== "auth" &&
      code !== "ssl" &&
      code !== "schema"
    ) {
      code = "loopback";
    }
    return { ok: false, hostKind: info.kind, code };
  }
}
