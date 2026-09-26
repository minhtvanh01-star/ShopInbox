import { afterEach, describe, expect, it } from "vitest";
import { cookieSecureFlag, requireSessionSecret } from "@/backend/app-secret";

const KEYS = ["SESSION_SECRET", "COOKIE_SECURE", "FORCE_HTTPS"] as const;

describe("app-secret", () => {
  const snapshot = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rejects short secrets", () => {
    process.env.SESSION_SECRET = "short";
    expect(() => requireSessionSecret()).toThrow(/SESSION_SECRET/);
  });

  it("treats COOKIE_SECURE=1 as secure cookies", () => {
    process.env.COOKIE_SECURE = "1";
    expect(cookieSecureFlag()).toBe(true);
  });

  it("keeps Secure cookies in production even when FORCE_HTTPS=0", () => {
    const env = process.env as { NODE_ENV?: string };
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    process.env.FORCE_HTTPS = "0";
    delete process.env.COOKIE_SECURE;
    try {
      expect(cookieSecureFlag()).toBe(true);
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it("rejects the .env.example sample secret in production", () => {
    const env = process.env as { NODE_ENV?: string };
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "shopinbox-dev-session-secret-change-me";
    try {
      expect(() => requireSessionSecret()).toThrow(/chuỗi mẫu/);
    } finally {
      env.NODE_ENV = previous;
    }
  });
});
