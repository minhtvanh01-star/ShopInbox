import { cookies } from "next/headers";
import { prisma } from "@/backend/prisma";
import { isLiveStaffSession } from "@/backend/session-live";
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

async function hydrateLiveSession(payload: SessionPayload): Promise<SessionPayload | null> {
  const staff = await prisma.staff.findUnique({
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

  if (!staff || !isLiveStaffSession(payload, staff)) {
    return null;
  }

  const isSuperAdmin = staff.isSuperAdmin;
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
