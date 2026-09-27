import { prisma } from "@/backend/prisma";
import {
  classifyDatabaseError,
  inspectDatabaseUrl,
  type DatabaseErrorCode,
  type DatabaseUrlHint,
  type DatabaseUrlKind,
} from "@/lib/database-url";

export type DatabaseProbe =
  | { ok: true; hostKind: DatabaseUrlKind; code: "ok"; hint: DatabaseUrlHint }
  | { ok: false; hostKind: DatabaseUrlKind; code: DatabaseErrorCode; hint: DatabaseUrlHint };

export async function probeDatabase(
  env: Record<string, string | undefined> = process.env,
): Promise<DatabaseProbe> {
  const info = inspectDatabaseUrl(env.DATABASE_URL);
  if (info.kind === "unset") {
    return { ok: false, hostKind: "unset", code: "missing_url", hint: info.hint };
  }
  if (info.kind === "invalid") {
    console.error("[probeDatabase] DATABASE_URL is not a postgres URI", { hint: info.hint });
    return { ok: false, hostKind: "invalid", code: "invalid_url", hint: info.hint };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, hostKind: info.kind, code: "ok", hint: info.hint };
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
    return { ok: false, hostKind: info.kind, code, hint: info.hint };
  }
}
