import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { requireSessionSecret } from "@/backend/app-secret";

export const EMAIL_OTP_PURPOSE_REGISTER = "register";
export const EMAIL_OTP_PURPOSE_PASSWORD_RESET = "password_reset";
export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_OTP_LOCKOUT_MS = 15 * 60 * 1000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
export const EMAIL_OTP_CODE_LENGTH = 6;

export type RegisterOtpPayload = {
  name: string;
  passwordHash: string;
};

export type PasswordResetOtpPayload = {
  passwordHash: string;
};

export function generateEmailOtpCode() {
  const max = 10 ** EMAIL_OTP_CODE_LENGTH;
  return String(randomInt(0, max)).padStart(EMAIL_OTP_CODE_LENGTH, "0");
}

function otpHmacKey() {
  return requireSessionSecret();
}

export function hashEmailOtpCode(code: string, context?: { purpose?: string; email?: string }) {
  const purpose = context?.purpose ?? "";
  const email = context?.email ?? "";
  return createHmac("sha256", otpHmacKey())
    .update(`${purpose}:${email}:${code.trim()}`)
    .digest("hex");
}

export function emailOtpCodesEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseRegisterOtpPayload(raw: string): RegisterOtpPayload | null {
  try {
    const data = JSON.parse(raw) as Partial<RegisterOtpPayload>;
    if (
      typeof data.name === "string" &&
      data.name.trim() &&
      typeof data.passwordHash === "string" &&
      data.passwordHash
    ) {
      return { name: data.name.trim(), passwordHash: data.passwordHash };
    }
  } catch {
    // ignore
  }
  return null;
}

export function parsePasswordResetOtpPayload(raw: string): PasswordResetOtpPayload | null {
  try {
    const data = JSON.parse(raw) as Partial<PasswordResetOtpPayload>;
    if (typeof data.passwordHash === "string" && data.passwordHash) {
      return { passwordHash: data.passwordHash };
    }
  } catch {
    // ignore
  }
  return null;
}
