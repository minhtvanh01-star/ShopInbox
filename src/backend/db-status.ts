import { prisma } from "@/backend/prisma";
import {
  classifyDatabaseError,
  databaseEnvPresence,
  inspectDatabaseUrl,
  resolveDatabaseUrlDetails,
  type DatabaseErrorCode,
  type DatabaseUrlHint,
  type DatabaseUrlKind,
  type DatabaseUrlSource,
} from "@/lib/database-url";

export type DatabaseProbe =
  | {
      ok: true;
      hostKind: DatabaseUrlKind;
      code: "ok";
      hint: DatabaseUrlHint;
      source: DatabaseUrlSource;
    }
  | {
      ok: false;
      hostKind: DatabaseUrlKind;
      code: DatabaseErrorCode;
      hint: DatabaseUrlHint;
      source: DatabaseUrlSource;
      env: ReturnType<typeof databaseEnvPresence>;
    };

export async function probeDatabase(
  env: Record<string, string | undefined> = process.env,
): Promise<DatabaseProbe> {
  const resolved = resolveDatabaseUrlDetails(env);
  const info = inspectDatabaseUrl(resolved.url || env.DATABASE_URL);
  const presence = databaseEnvPresence(env);
  if (info.kind === "unset") {
    return {
      ok: false,
      hostKind: "unset",
      code: "missing_url",
      hint: info.hint,
      source: resolved.source,
      env: presence,
    };
  }
  if (info.kind === "invalid") {
    console.error("[probeDatabase] DATABASE_URL is not a postgres URI", {
      hint: info.hint,
      source: resolved.source,
      env: presence,
    });
    return {
      ok: false,
      hostKind: "invalid",
      code: "invalid_url",
      hint: info.hint,
      source: resolved.source,
      env: presence,
    };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
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
    return {
      ok: false,
      hostKind: info.kind,
      code,
      hint: info.hint,
      source: resolved.source,
      env: presence,
    };
  }
  try {
    await prisma.staff.count();
    return { ok: true, hostKind: info.kind, code: "ok", hint: info.hint, source: resolved.source };
  } catch (error) {
    return {
      ok: false,
      hostKind: info.kind,
      code: classifyDatabaseError(error),
      hint: info.hint,
      source: resolved.source,
      env: presence,
    };
  }
}
