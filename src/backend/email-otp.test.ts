import { afterEach, describe, expect, it } from "vitest";
import {
  generateEmailOtpCode,
  hashEmailOtpCode,
  parsePasswordResetOtpPayload,
  parseRegisterOtpPayload,
  EMAIL_OTP_CODE_LENGTH,
} from "@/backend/email-otp-code";
import {
  buildPasswordResetOtpEmail,
  buildRegisterOtpEmail,
  canSendRegisterOtp,
  getSmtpConfig,
  normalizeSmtpSecret,
} from "@/backend/email";
import { validatePasswordResetInput } from "@/backend/register";

describe("email OTP helpers", () => {
  it("generates a fixed-length numeric code", () => {
    const code = generateEmailOtpCode();
    expect(code).toHaveLength(EMAIL_OTP_CODE_LENGTH);
    expect(code).toMatch(/^\d+$/);
  });

  it("hashes codes deterministically", () => {
    expect(hashEmailOtpCode("123456")).toBe(hashEmailOtpCode("123456"));
    expect(hashEmailOtpCode("123456")).not.toBe(hashEmailOtpCode("654321"));
  });

  it("parses register payload", () => {
    expect(
      parseRegisterOtpPayload(JSON.stringify({ name: "Minh", passwordHash: "hash" })),
    ).toEqual({ name: "Minh", passwordHash: "hash" });
    expect(parseRegisterOtpPayload("{}")).toBeNull();
  });

  it("parses password reset payload", () => {
    expect(parsePasswordResetOtpPayload(JSON.stringify({ passwordHash: "hash" }))).toEqual({
      passwordHash: "hash",
    });
    expect(parsePasswordResetOtpPayload("{}")).toBeNull();
  });

  it("builds OTP email content", () => {
    const mail = buildRegisterOtpEmail("482913");
    expect(mail.subject).toContain("ShopInbox");
    expect(mail.text).toContain("482913");
    expect(mail.html).toContain("482913");
  });

  it("builds password reset OTP email content", () => {
    const mail = buildPasswordResetOtpEmail("119922");
    expect(mail.subject).toContain("đổi mật khẩu");
    expect(mail.text).toContain("119922");
    expect(mail.html).toContain("119922");
  });

  it("strips spaces from SMTP / App Password secrets", () => {
    expect(normalizeSmtpSecret("abcd efgh ijkl mnop")).toBe("abcdefghijklmnop");
    expect(normalizeSmtpSecret("  x y  ")).toBe("xy");
  });
});

describe("validatePasswordResetInput", () => {
  it("accepts valid email and matching passwords", () => {
    const result = validatePasswordResetInput({
      email: " Admin@Lily.vn ",
      password: "NewPass@12",
      confirmPassword: "NewPass@12",
    });
    expect(result).toEqual({
      ok: true,
      data: { email: "admin@lily.vn", password: "NewPass@12" },
    });
  });

  it("rejects mismatched confirm password", () => {
    const result = validatePasswordResetInput({
      email: "admin@lily.vn",
      password: "NewPass@12",
      confirmPassword: "other",
    });
    expect(result.ok).toBe(false);
  });
});

describe("getSmtpConfig password normalization", () => {
  const keys = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "GMAIL_USER",
    "GMAIL_APP_PASSWORD",
    "SMTP_FROM",
    "EMAIL_OTP_DEV_LOG",
  ] as const;
  const snapshot = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const key of keys) {
      const value = snapshot[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("accepts Gmail App Password with spaces", () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.GMAIL_USER = "shop@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    const config = getSmtpConfig();
    expect(config?.pass).toBe("abcdefghijklmnop");
    expect(config?.user).toBe("shop@gmail.com");
  });

  it("canSendRegisterOtp allows DEV_LOG without SMTP", () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.EMAIL_OTP_DEV_LOG = "1";
    expect(getSmtpConfig()).toBeNull();
    expect(canSendRegisterOtp()).toBe(true);
  });
});
