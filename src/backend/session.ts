import { cookies } from "next/headers";
import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { isLiveStaffSession, sessionVersionOf } from "@/backend/session-live";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  toSessionPayload,
  verifySessionToken,
  type SessionPayload,
} from "@/backend/session-token";

export { SESSION_COOKIE, type SessionPayload };
export {
  SESSION_IDLE_MINUTES,
  SESSION_IDLE_MS,
  verifySessionToken,
} from "@/backend/session-token";

export async function setSessionCookie(
  payload: Omit<SessionPayload, "lastActiveAt"> & { lastActiveAt?: number },
) {
  const token = await createSessionToken({
    ...payload,
    lastActiveAt: payload.lastActiveAt ?? Date.now(),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function loadStaffForLiveSession(payload: SessionPayload) {
  try {
    return await prisma.staff.findUnique({
      where: { id: payload.staffId },
      select: {
        id: true,
        shopId: true,
        email: true,
        name: true,
        roleCode: true,
        isActive: true,
        isSuperAdmin: true,
        sessionVersion: true,
        shop: { select: { setupCompletedAt: true, suspendedAt: true } },
      },
    });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }
    console.error("[hydrateLiveSession] missing session columns — loading without shop-ops flags", error);
    const staff = await prisma.staff.findUnique({
      where: { id: payload.staffId },
      select: {
        id: true,
        shopId: true,
        email: true,
        name: true,
        roleCode: true,
        isActive: true,
      },
    });
    if (!staff) return null;
    return {
      ...staff,
      isSuperAdmin: false,
      sessionVersion: sessionVersionOf(payload.sessionVersion),
      shop: { setupCompletedAt: new Date(0), suspendedAt: null as Date | null },
    };
  }
}

async function hydrateLiveSession(payload: SessionPayload): Promise<SessionPayload | null> {
  const staff = await loadStaffForLiveSession(payload);

  if (!staff || !isLiveStaffSession(payload, staff)) {
    return null;
  }

  const { resolveIsSuperAdmin } = await import("@/backend/super-admin");
  const isSuperAdmin = await resolveIsSuperAdmin({
    id: staff.id,
    email: staff.email,
    isSuperAdmin: Boolean(staff.isSuperAdmin) || Boolean(payload.isSuperAdmin),
  });
  if (staff.shop.suspendedAt && !isSuperAdmin) {
    return null;
  }

  return {
    ...toSessionPayload({
      ...staff,
      shopSetupComplete: Boolean(staff.shop.setupCompletedAt),
      isSuperAdmin,
    }),
    lastActiveAt: payload.lastActiveAt,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return hydrateLiveSession(payload);
}

/** JWT còn hạn nhưng staff đã tắt / đổi mật khẩu. */
export async function hasRevokedSessionCookie() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const payload = await verifySessionToken(token);
  if (!payload) return false;
  return (await hydrateLiveSession(payload)) === null;
}
