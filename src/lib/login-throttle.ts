/** Giới hạn đăng nhập mật khẩu — dùng chung server + test (không phụ thuộc Prisma). */

export const LOGIN_FAIL_LIMIT = 8;
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_GENERIC_ERROR = "Email hoặc mật khẩu không đúng.";
export const LOGIN_THROTTLE_ERROR = "Bạn đã thử quá nhiều lần. Thử lại sau 15 phút.";

export type LoginThrottleState = {
  failCount: number;
  windowStartedAt: number;
};

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Cửa sổ hết hạn → coi như chưa có lần sai. */
export function resetLoginThrottleIfExpired(
  state: LoginThrottleState | null,
  now = Date.now(),
): LoginThrottleState | null {
  if (!state) return null;
  if (now - state.windowStartedAt >= LOGIN_FAIL_WINDOW_MS) return null;
  return state;
}

export function isLoginThrottled(state: LoginThrottleState | null, now = Date.now()) {
  const current = resetLoginThrottleIfExpired(state, now);
  return Boolean(current && current.failCount >= LOGIN_FAIL_LIMIT);
}

/** Lỗi đọc/ghi bảng throttle (chưa migrate, DB down) không được coi như user đã bị khóa. */
export function loginThrottleOnStoreError() {
  return false;
}

export function nextLoginFailureState(
  state: LoginThrottleState | null,
  now = Date.now(),
): LoginThrottleState {
  const current = resetLoginThrottleIfExpired(state, now);
  if (!current) {
    return { failCount: 1, windowStartedAt: now };
  }
  return { failCount: current.failCount + 1, windowStartedAt: current.windowStartedAt };
}
