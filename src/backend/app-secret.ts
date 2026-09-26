const MIN_DEV_LENGTH = 16;
const MIN_PROD_LENGTH = 32;
const INSECURE_SAMPLE_SECRETS = new Set(["shopinbox-dev-session-secret-change-me"]);

/** SESSION_SECRET dùng ký JWT + HMAC OTP. Production bắt buộc ≥ 32 ký tự, không dùng chuỗi mẫu. */
export function requireSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  const min = process.env.NODE_ENV === "production" ? MIN_PROD_LENGTH : MIN_DEV_LENGTH;
  if (secret.length < min) {
    throw new Error(`Thiếu SESSION_SECRET (tối thiểu ${min} ký tự) trong .env`);
  }
  if (process.env.NODE_ENV === "production" && INSECURE_SAMPLE_SECRETS.has(secret)) {
    throw new Error("SESSION_SECRET đang dùng chuỗi mẫu .env.example — đổi trước khi production.");
  }
  return secret;
}

export function sessionSecretBytes() {
  return new TextEncoder().encode(requireSessionSecret());
}

export function cookieSecureFlag() {
  if (process.env.COOKIE_SECURE === "0") return false;
  if (process.env.COOKIE_SECURE === "1") return true;
  return process.env.NODE_ENV === "production";
}
