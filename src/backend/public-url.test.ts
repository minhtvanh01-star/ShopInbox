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
    process.env.NEXT_PUBLIC_APP_URL = "https://shopinbox-production.up.railway.app";
    const request = new Request("http://localhost:8080/api/auth/google/callback?code=x");
    expect(getRequestOrigin(request)).toBe("https://shopinbox-production.up.railway.app");
    expect(absoluteAppUrl(request, "/inbox").toString()).toBe(
      "https://shopinbox-production.up.railway.app/inbox",
    );
  });

  it("uses x-forwarded-host when app URL unset", () => {
    stash();
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    const request = new Request("http://localhost:8080/login", {
      headers: {
        "x-forwarded-host": "shopinbox-production.up.railway.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(getRequestOrigin(request)).toBe("https://shopinbox-production.up.railway.app");
  });

  it("maps bare localhost:8080 to getPublicAppUrl fallback", () => {
    stash();
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    const request = new Request("http://localhost:8080/inbox");
    expect(getRequestOrigin(request)).toBe("http://localhost:3000");
  });
});
