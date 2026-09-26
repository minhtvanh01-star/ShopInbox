import { describe, expect, it } from "vitest";
import {
  LOGIN_FAIL_LIMIT,
  LOGIN_FAIL_WINDOW_MS,
  LOGIN_GENERIC_ERROR,
  LOGIN_THROTTLE_ERROR,
  isLoginThrottled,
  loginThrottleOnStoreError,
  nextLoginFailureState,
  normalizeLoginEmail,
  resetLoginThrottleIfExpired,
} from "@/lib/login-throttle";

describe("login throttle", () => {
  const started = 1_700_000_000_000;

  it("normalizes email", () => {
    expect(normalizeLoginEmail("  Admin@Lily.VN ")).toBe("admin@lily.vn");
  });

  it("does not lock a first login when the throttle store is down", () => {
    expect(loginThrottleOnStoreError()).toBe(false);
  });

  it("keeps throttle copy distinct from a generic credential error", () => {
    expect(LOGIN_THROTTLE_ERROR).toMatch(/15 phút/);
    expect(LOGIN_THROTTLE_ERROR).not.toBe(LOGIN_GENERIC_ERROR);
  });

  it("allows attempts until the limit", () => {
    let state = nextLoginFailureState(null, started);
    for (let i = 1; i < LOGIN_FAIL_LIMIT; i += 1) {
      expect(isLoginThrottled(state, started + i * 1000)).toBe(false);
      state = nextLoginFailureState(state, started + i * 1000);
    }
    expect(state.failCount).toBe(LOGIN_FAIL_LIMIT);
    expect(isLoginThrottled(state, started + LOGIN_FAIL_LIMIT * 1000)).toBe(true);
  });

  it("opens a new window after 15 minutes", () => {
    const blocked = { failCount: LOGIN_FAIL_LIMIT, windowStartedAt: started };
    expect(isLoginThrottled(blocked, started + LOGIN_FAIL_WINDOW_MS - 1)).toBe(true);
    expect(resetLoginThrottleIfExpired(blocked, started + LOGIN_FAIL_WINDOW_MS)).toBeNull();
    expect(isLoginThrottled(blocked, started + LOGIN_FAIL_WINDOW_MS)).toBe(false);

    const next = nextLoginFailureState(blocked, started + LOGIN_FAIL_WINDOW_MS);
    expect(next).toEqual({ failCount: 1, windowStartedAt: started + LOGIN_FAIL_WINDOW_MS });
  });
});
