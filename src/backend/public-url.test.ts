import { afterEach, describe, expect, it } from "vitest";
import { absoluteAppUrl, getRequestOrigin } from "@/backend/public-url";

const KEYS = ["NEXT_PUBLIC_APP_URL", "APP_URL"] as const;
const saved: Record<string, string | undefined> = {};

function stash() {
  for (const key of KEYS) saved[key] = process.env[key];
}

function restore() {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

describe("getRequestOrigin / absoluteAppUrl", () => {
  afterEach(restore);

  it("prefers NEXT_PUBLIC_APP_URL over Railway internal localhost:8080", () => {
    stash();
    process.env.NEXT_PUBLIC_APP_URL = "https://shopinbox.example.com";
    const request = new Request("http://localhost:8080/api/auth/google/callback?code=x");
    expect(getRequestOrigin(request)).toBe("https://shopinbox.example.com");
    expect(absoluteAppUrl(request, "/inbox").toString()).toBe(
      "https://shopinbox.example.com/inbox",
    );
  });

  it("uses x-forwarded-host when app URL unset", () => {
    stash();
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    const request = new Request("http://localhost:8080/login", {
      headers: {
        "x-forwarded-host": "shopinbox.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(getRequestOrigin(request)).toBe("https://shopinbox.example.com");
  });

  it("ignores forwarded host in production when app URL is set to localhost fallback", () => {
    stash();
    const env = process.env as { NODE_ENV?: string };
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    try {
      const request = new Request("http://localhost:8080/login", {
        headers: {
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https",
        },
      });
      expect(getRequestOrigin(request)).not.toContain("evil.example");
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it("maps bare localhost:8080 to getPublicAppUrl fallback", () => {
    stash();
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    const request = new Request("http://localhost:8080/inbox");
    expect(getRequestOrigin(request)).toBe("http://localhost:3000");
  });

  it("accepts NEXT_PUBLIC_APP_URL without https:// so /loginpin redirect cannot throw", () => {
    stash();
    process.env.NEXT_PUBLIC_APP_URL = "shopinboxn2.linhgunxy.xyz";
    const request = new Request("http://localhost:8080/loginpin");
    expect(getRequestOrigin(request)).toBe("https://shopinboxn2.linhgunxy.xyz");
    expect(absoluteAppUrl(request, "/login").toString()).toBe(
      "https://shopinboxn2.linhgunxy.xyz/login",
    );
  });

  it("falls back when APP_URL is not a valid origin", () => {
    stash();
    const env = process.env as { NODE_ENV?: string };
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "://bad";
    delete process.env.APP_URL;
    try {
      const request = new Request("http://localhost:8080/loginpin");
      expect(() => absoluteAppUrl(request, "/login")).not.toThrow();
      expect(absoluteAppUrl(request, "/login").pathname).toBe("/login");
    } finally {
      env.NODE_ENV = previous;
    }
  });
});
