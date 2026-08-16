import { createHash, randomInt } from "node:crypto";

export const EMAIL_OTP_PURPOSE_REGISTER = "register";
export const EMAIL_OTP_PURPOSE_PASSWORD_RESET = "password_reset";
export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
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

export function hashEmailOtpCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
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
