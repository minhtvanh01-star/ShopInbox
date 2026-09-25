import { prisma } from "@/backend/prisma";
import { isLoginThrottled, normalizeLoginEmail } from "@/lib/login-throttle";

export {
  LOGIN_FAIL_LIMIT,
  LOGIN_FAIL_WINDOW_MS,
  LOGIN_GENERIC_ERROR,
  LOGIN_THROTTLE_ERROR,
  isLoginThrottled,
  normalizeLoginEmail,
} from "@/lib/login-throttle";

function toState(row: { failCount: number; windowStartedAt: Date } | null) {
  if (!row) return null;
  return { failCount: row.failCount, windowStartedAt: row.windowStartedAt.getTime() };
}

export async function isLoginEmailThrottled(email: string) {
  const key = normalizeLoginEmail(email);
  if (!key) return false;
  try {
    const row = await prisma.authLoginThrottle.findUnique({ where: { email: key } });
    return isLoginThrottled(toState(row));
  } catch (error) {
    console.error("[login-throttle] read failed", error);
    return true;
  }
}

export async function recordLoginFailure(email: string) {
  const key = normalizeLoginEmail(email);
  if (!key) return;

  try {
    await prisma.$executeRaw`
      INSERT INTO "auth_login_throttles" ("email", "failCount", "windowStartedAt", "updatedAt")
      VALUES (${key}, 1, NOW(), NOW())
      ON CONFLICT ("email") DO UPDATE SET
        "failCount" = CASE
          WHEN "auth_login_throttles"."windowStartedAt" <= NOW() - INTERVAL '15 minutes'
          THEN 1
          ELSE "auth_login_throttles"."failCount" + 1
        END,
        "windowStartedAt" = CASE
          WHEN "auth_login_throttles"."windowStartedAt" <= NOW() - INTERVAL '15 minutes'
          THEN NOW()
          ELSE "auth_login_throttles"."windowStartedAt"
        END,
        "updatedAt" = NOW()
    `;
  } catch (error) {
    console.error("[login-throttle] write failed", error);
    throw error;
  }
}

export async function clearLoginFailures(email: string) {
  const key = normalizeLoginEmail(email);
  if (!key) return;
  try {
    await prisma.authLoginThrottle.deleteMany({ where: { email: key } });
  } catch (error) {
    console.error("[login-throttle] clear failed", error);
  }
}
