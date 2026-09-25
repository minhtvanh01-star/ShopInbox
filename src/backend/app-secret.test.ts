import { afterEach, describe, expect, it } from "vitest";
import { cookieSecureFlag, requireSessionSecret } from "@/backend/app-secret";

const KEYS = ["SESSION_SECRET", "COOKIE_SECURE"] as const;

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
});
