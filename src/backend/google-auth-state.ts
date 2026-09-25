import { SignJWT, jwtVerify } from "jose";
import { cookieSecureFlag, sessionSecretBytes } from "@/backend/app-secret";

export const GOOGLE_AUTH_STATE_COOKIE = "shopinbox_google_auth_state";
export const GOOGLE_PKCE_COOKIE = "shopinbox_google_pkce";

export type GoogleAuthMode = "login" | "register" | "link";

export type GoogleAuthStatePayload = {
  nonce: string;
  next: string;
  mode: GoogleAuthMode;
  staffId?: string;
};

export function googleAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecureFlag(),
    path: "/",
    maxAge: 60 * 15,
  };
}

export async function createGoogleAuthStateToken(payload: GoogleAuthStatePayload) {
  return new SignJWT({
    nonce: payload.nonce,
    next: payload.next,
    mode: payload.mode,
    staffId: payload.staffId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(sessionSecretBytes());
}

export async function verifyGoogleAuthStateToken(
  token: string,
): Promise<GoogleAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecretBytes());
    if (typeof payload.nonce !== "string" || typeof payload.next !== "string") {
      return null;
    }

    const mode = payload.mode;
    if (mode !== "login" && mode !== "register" && mode !== "link") {
      return null;
    }

    const staffId = typeof payload.staffId === "string" ? payload.staffId : undefined;
    if (mode === "link" && !staffId) {
      return null;
    }

    return {
      nonce: payload.nonce,
      next: payload.next,
      mode,
      staffId,
    };
  } catch {
    return null;
  }
}

export async function createGooglePkceToken(codeVerifier: string) {
  return new SignJWT({ v: codeVerifier })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(sessionSecretBytes());
}

export async function verifyGooglePkceToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecretBytes());
    return typeof payload.v === "string" && payload.v.length >= 43 ? payload.v : null;
  } catch {
    return null;
  }
}
