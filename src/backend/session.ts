import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
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

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
