/** Hằng số dùng được trên client — không import từ register.ts (tránh kéo backend). */
export const REGISTER_MIN_PASSWORD_LENGTH = 8;
export const REGISTER_NAME_MAX = 100;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string) {
  return EMAIL_RE.test(email);
}
