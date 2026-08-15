/** Chính sách phiên đăng nhập — dùng chung server + client (không phụ thuộc jose). */

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_IDLE_MINUTES = 30;
export const SESSION_COOKIE_MAX_AGE_SEC = 30 * 60;
export const SESSION_REFRESH_INTERVAL_MS = 60 * 1000;
export const SESSION_ABSOLUTE_MAX = "12h";
