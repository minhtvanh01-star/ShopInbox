const MIN_DEV_LENGTH = 16;
const MIN_PROD_LENGTH = 32;

/** SESSION_SECRET dùng ký JWT + HMAC OTP. Production bắt buộc ≥ 32 ký tự. */
export function requireSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  const min = process.env.NODE_ENV === "production" ? MIN_PROD_LENGTH : MIN_DEV_LENGTH;
  if (secret.length < min) {
    throw new Error(`Thiếu SESSION_SECRET (tối thiểu ${min} ký tự) trong .env`);
  }
  return secret;
}

export function sessionSecretBytes() {
  return new TextEncoder().encode(requireSessionSecret());
}

export function cookieSecureFlag() {
  return process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "1";
}
