import { SignJWT, jwtVerify } from "jose";
import type { StaffRole } from "@/lib/types";

export const SESSION_COOKIE = "shopinbox_session";

export type SessionPayload = {
  staffId: string;
  shopId: string;
  email: string;
  name: string;
  role: StaffRole;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("Thiếu SESSION_SECRET (tối thiểu 16 ký tự) trong .env");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({
    staffId: payload.staffId,
    shopId: payload.shopId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.staffId !== "string" ||
      typeof payload.shopId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "owner" && payload.role !== "staff")
    ) {
      return null;
    }

    return {
      staffId: payload.staffId,
      shopId: payload.shopId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
