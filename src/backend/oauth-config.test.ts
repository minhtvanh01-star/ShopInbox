import { afterEach, describe, expect, it } from "vitest";
import {
  getMetaOAuthConfig,
  getZaloOAuthConfig,
  listMissingMetaOAuthEnvVars,
  listMissingZaloOAuthEnvVars,
} from "@/backend/oauth-config";

const META_KEYS = ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "META_WEBHOOK_VERIFY_TOKEN"] as const;
const ZALO_KEYS = ["ZALO_APP_ID", "ZALO_APP_SECRET", "ZALO_REDIRECT_URI"] as const;

const saved: Record<string, string | undefined> = {};

function stashEnv(keys: readonly string[]) {
  for (const key of keys) {
    saved[key] = process.env[key];
  }
}

function restoreEnv(keys: readonly string[]) {
  for (const key of keys) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
}

describe("oauth-config", () => {
  afterEach(() => {
    restoreEnv([...META_KEYS, ...ZALO_KEYS]);
  });

  it("lists missing Meta env vars and returns null config", () => {
    stashEnv(META_KEYS);
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.META_REDIRECT_URI;

    expect(listMissingMetaOAuthEnvVars()).toEqual([
      "META_APP_ID",
      "META_APP_SECRET",
      "META_REDIRECT_URI",
    ]);
    expect(getMetaOAuthConfig()).toBeNull();
  });

  it("accepts Meta config without webhook verify token", () => {
    stashEnv(META_KEYS);
    process.env.META_APP_ID = "meta-app";
    process.env.META_APP_SECRET = "meta-secret";
    process.env.META_REDIRECT_URI = "http://localhost:3000/api/connect/meta/callback";
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;

    expect(listMissingMetaOAuthEnvVars()).toEqual([]);
    expect(getMetaOAuthConfig()).toEqual({
      appId: "meta-app",
      appSecret: "meta-secret",
      redirectUri: "http://localhost:3000/api/connect/meta/callback",
      webhookVerifyToken: "",
    });
  });

  it("lists missing Zalo env vars", () => {
    stashEnv(ZALO_KEYS);
    process.env.ZALO_APP_ID = "zalo-app";
    delete process.env.ZALO_APP_SECRET;
    delete process.env.ZALO_REDIRECT_URI;

    expect(listMissingZaloOAuthEnvVars()).toEqual(["ZALO_APP_SECRET", "ZALO_REDIRECT_URI"]);
    expect(getZaloOAuthConfig()).toBeNull();
  });
});
