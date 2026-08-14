import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/backend/session-token";

export { SESSION_COOKIE, type SessionPayload };
export { verifySessionToken } from "@/backend/session-token";

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
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
