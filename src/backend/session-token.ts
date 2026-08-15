import { SignJWT, jwtVerify } from "jose";
import { normalizeRoleCode } from "@/lib/rbac-catalog";
import {
  SESSION_ABSOLUTE_MAX,
  SESSION_COOKIE_MAX_AGE_SEC,
  SESSION_IDLE_MS,
  SESSION_REFRESH_INTERVAL_MS,
} from "@/lib/session-policy";

export const SESSION_COOKIE = "shopinbox_session";
export {
  SESSION_IDLE_MS,
  SESSION_IDLE_MINUTES,
  SESSION_COOKIE_MAX_AGE_SEC,
  SESSION_REFRESH_INTERVAL_MS,
  SESSION_ABSOLUTE_MAX,
} from "@/lib/session-policy";

export function sessionCookieOptions(maxAgeSec = SESSION_COOKIE_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}

export type SessionPayload = {
  staffId: string;
  shopId: string;
  email: string;
  name: string;
  role: string;
  /** Epoch ms — lần hoạt động gần nhất (sliding idle). */
  lastActiveAt: number;
};

export function toSessionPayload(staff: {
  id: string;
  shopId: string;
  email: string;
  name: string;
  roleCode: string;
}): Omit<SessionPayload, "lastActiveAt"> {
  return {
    staffId: staff.id,
    shopId: staff.shopId,
    email: staff.email,
    name: staff.name,
    role: normalizeRoleCode(staff.roleCode),
  };
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("Thiếu SESSION_SECRET (tối thiểu 16 ký tự) trong .env");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "lastActiveAt"> & { lastActiveAt?: number },
) {
  const role = normalizeRoleCode(payload.role);
  const lastActiveAt = payload.lastActiveAt ?? Date.now();
  return new SignJWT({
    staffId: payload.staffId,
    shopId: payload.shopId,
    email: payload.email,
    name: payload.name,
    role,
    lastActiveAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_ABSOLUTE_MAX)
    .sign(getSecret());
}

export function isSessionIdleExpired(lastActiveAt: number, now = Date.now()) {
  return !Number.isFinite(lastActiveAt) || now - lastActiveAt > SESSION_IDLE_MS;
}

export function shouldRefreshSession(lastActiveAt: number, now = Date.now()) {
  return now - lastActiveAt >= SESSION_REFRESH_INTERVAL_MS;
}

export async function verifySessionToken(
  token: string,
  now = Date.now(),
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.staffId !== "string" ||
      typeof payload.shopId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      payload.role.length === 0
    ) {
      return null;
    }

    const lastActiveAt =
      typeof payload.lastActiveAt === "number"
        ? payload.lastActiveAt
        : typeof payload.iat === "number"
          ? payload.iat * 1000
          : null;

    if (lastActiveAt === null || isSessionIdleExpired(lastActiveAt, now)) {
      return null;
    }

    return {
      staffId: payload.staffId,
      shopId: payload.shopId,
      email: payload.email,
      name: payload.name,
      role: normalizeRoleCode(payload.role),
      lastActiveAt,
    };
  } catch {
    return null;
  }
}
