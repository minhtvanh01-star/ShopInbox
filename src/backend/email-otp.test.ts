import { afterEach, describe, expect, it } from "vitest";

process.env.SESSION_SECRET ??= "shopinbox-test-session-secret";
import {
  generateEmailOtpCode,
  hashEmailOtpCode,
  parsePasswordResetOtpPayload,
  parseProfileOtpPayload,
  parseRegisterOtpPayload,
  EMAIL_OTP_CODE_LENGTH,
} from "@/backend/email-otp-code";
import {
  buildPasswordResetOtpEmail,
  buildRegisterOtpEmail,
  canSendRegisterOtp,
  getSmtpConfig,
  normalizeSmtpSecret,
  publicOtpSendError,
  shouldLogEmailOtpCode,
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
    expect(
      hashEmailOtpCode("123456", { purpose: "register", email: "a@b.c" }),
    ).not.toBe(hashEmailOtpCode("123456", { purpose: "password_reset", email: "a@b.c" }));
  });

  it("parses register payload", () => {
    expect(
      parseRegisterOtpPayload(JSON.stringify({ name: "Minh", passwordHash: "hash" })),
    ).toEqual({ name: "Minh", passwordHash: "hash" });
    expect(parseRegisterOtpPayload("{}")).toBeNull();
  });

  it("parses profile OTP payload", () => {
    expect(
      parseProfileOtpPayload(JSON.stringify({ staffId: "staff-1", passwordHash: "hash" })),
    ).toEqual({ staffId: "staff-1", passwordHash: "hash" });
    expect(parseProfileOtpPayload(JSON.stringify({ staffId: "staff-1" }))).toEqual({
      staffId: "staff-1",
    });
    expect(parseProfileOtpPayload("{}")).toBeNull();
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

  it("canSendRegisterOtp allows DEV_LOG without SMTP outside production", () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.EMAIL_OTP_DEV_LOG = "1";
    expect(getSmtpConfig()).toBeNull();
    expect(canSendRegisterOtp()).toBe(true);
    expect(shouldLogEmailOtpCode()).toBe(process.env.NODE_ENV !== "production");
  });

  it("never treats DEV_LOG as enough in production", () => {
    const env = process.env as { NODE_ENV?: string };
    const previous = env.NODE_ENV;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.EMAIL_OTP_DEV_LOG = "1";
    env.NODE_ENV = "production";
    try {
      expect(canSendRegisterOtp()).toBe(false);
      expect(shouldLogEmailOtpCode()).toBe(false);
    } finally {
      env.NODE_ENV = previous;
    }
  });
});

describe("publicOtpSendError", () => {
  it("keeps cooldown text and hides SMTP details", () => {
    expect(publicOtpSendError(new Error("Vui lòng đợi 12s trước khi gửi lại mã."), "fallback")).toMatch(
      /Vui lòng đợi 12s/,
    );
    expect(
      publicOtpSendError(new Error("Nhập sai quá nhiều lần. Vui lòng đợi rồi thử lại."), "fallback"),
    ).toMatch(/Nhập sai quá nhiều lần/);
    expect(publicOtpSendError(new Error("Invalid login: 535-5.7.8"), "Không gửi được mã.")).toBe(
      "Không gửi được mã.",
    );
  });
});
