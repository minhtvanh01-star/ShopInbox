import { SignJWT, jwtVerify } from "jose";

export const GOOGLE_AUTH_STATE_COOKIE = "shopinbox_google_auth_state";

export type GoogleAuthMode = "login" | "link";

export type GoogleAuthStatePayload = {
  nonce: string;
  next: string;
  mode: GoogleAuthMode;
  staffId?: string;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("Thiếu SESSION_SECRET (tối thiểu 16 ký tự) trong .env");
  }
  return new TextEncoder().encode(secret);
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
    .sign(getSecret());
}

export async function verifyGoogleAuthStateToken(
  token: string,
): Promise<GoogleAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.nonce !== "string" || typeof payload.next !== "string") {
      return null;
    }

    const mode = payload.mode;
    if (mode !== "login" && mode !== "link") {
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
