import { afterEach, describe, expect, it } from "vitest";
import {
  getMetaOAuthConfig,
  getMetaOAuthRedirectUri,
  getPublicAppUrl,
  getShopifyOAuthConfig,
  getShopifyWebhookUrl,
  getZaloOAuthConfig,
  isUsableOAuthRedirectUri,
  listMissingMetaOAuthEnvVars,
  listMissingShopifyOAuthEnvVars,
  listMissingZaloOAuthEnvVars,
  normalizeAppOrigin,
  resolveOAuthRedirectUri,
} from "@/backend/oauth-config";

const META_KEYS = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_REDIRECT_URI",
  "META_WEBHOOK_VERIFY_TOKEN",
  "NEXT_PUBLIC_APP_URL",
] as const;
const ZALO_KEYS = ["ZALO_APP_ID", "ZALO_APP_SECRET", "ZALO_REDIRECT_URI", "NEXT_PUBLIC_APP_URL"] as const;
const SHOPIFY_KEYS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_REDIRECT_URI",
  "NEXT_PUBLIC_APP_URL",
] as const;

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
    restoreEnv([...META_KEYS, ...ZALO_KEYS, ...SHOPIFY_KEYS]);
  });

  it("lists missing Meta env vars and returns null config", () => {
    stashEnv(META_KEYS);
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.META_REDIRECT_URI;

    expect(listMissingMetaOAuthEnvVars()).toEqual(["META_APP_ID", "META_APP_SECRET"]);
    expect(getMetaOAuthConfig()).toBeNull();
  });

  it("accepts Meta config without webhook verify token", () => {
    stashEnv(META_KEYS);
    process.env.META_APP_ID = "meta-app";
    process.env.META_APP_SECRET = "meta-secret";
    process.env.META_REDIRECT_URI = "http://localhost:3000/api/connect/meta/callback";
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(listMissingMetaOAuthEnvVars()).toEqual([]);
    expect(getMetaOAuthConfig()).toEqual({
      appId: "meta-app",
      appSecret: "meta-secret",
      redirectUri: "http://localhost:3000/api/connect/meta/callback",
      webhookVerifyToken: "",
    });
  });

  it("derives Meta redirect from NEXT_PUBLIC_APP_URL when META_REDIRECT_URI unset", () => {
    stashEnv(META_KEYS);
    process.env.META_APP_ID = "meta-app";
    process.env.META_APP_SECRET = "meta-secret";
    delete process.env.META_REDIRECT_URI;
    process.env.NEXT_PUBLIC_APP_URL = "https://shopinbox.example.com";

    expect(getMetaOAuthRedirectUri()).toBe(
      "https://shopinbox.example.com/api/connect/meta/callback",
    );
    expect(getMetaOAuthConfig()?.redirectUri).toBe(
      "https://shopinbox.example.com/api/connect/meta/callback",
    );
  });

  it("overrides localhost Meta redirect when NEXT_PUBLIC_APP_URL is production", () => {
    stashEnv(META_KEYS);
    process.env.META_APP_ID = "meta-app";
    process.env.META_APP_SECRET = "meta-secret";
    process.env.META_REDIRECT_URI = "http://localhost:3000/api/connect/meta/callback";
    process.env.NEXT_PUBLIC_APP_URL = "https://shopinbox.example.com";

    expect(getMetaOAuthConfig()?.redirectUri).toBe(
      "https://shopinbox.example.com/api/connect/meta/callback",
    );
  });

  it("lists missing Shopify env vars and derives webhook from origin", () => {
    stashEnv(SHOPIFY_KEYS);
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    expect(listMissingShopifyOAuthEnvVars()).toEqual(["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"]);
    expect(getShopifyOAuthConfig()).toBeNull();

    process.env.SHOPIFY_API_KEY = "key-1";
    process.env.SHOPIFY_API_SECRET = "secret-1";
    delete process.env.SHOPIFY_REDIRECT_URI;
    process.env.NEXT_PUBLIC_APP_URL = "https://shopinbox.example.com";
    expect(getShopifyOAuthConfig()?.redirectUri).toBe(
      "https://shopinbox.example.com/api/connect/shopify/callback",
    );
    expect(getShopifyWebhookUrl("https://shopinbox.n2.tinhgon.xyz")).toBe(
      "https://shopinbox.n2.tinhgon.xyz/api/webhooks/shopify",
    );
  });

  it("lists missing Zalo env vars", () => {
    stashEnv(ZALO_KEYS);
    process.env.ZALO_APP_ID = "zalo-app";
    delete process.env.ZALO_APP_SECRET;
    delete process.env.ZALO_REDIRECT_URI;

    expect(listMissingZaloOAuthEnvVars()).toEqual(["ZALO_APP_SECRET"]);
    expect(getZaloOAuthConfig()).toBeNull();
  });
});

describe("resolveOAuthRedirectUri", () => {
  afterEach(() => {
    restoreEnv(["NEXT_PUBLIC_APP_URL", "APP_URL"]);
  });

  it("prefers production app URL over localhost redirect env", () => {
    stashEnv(["NEXT_PUBLIC_APP_URL", "APP_URL"]);
    process.env.NEXT_PUBLIC_APP_URL = "https://shopinbox.example.com";
    expect(
      resolveOAuthRedirectUri(
        "http://localhost:3000/api/auth/google/callback",
        "/api/auth/google/callback",
      ),
    ).toBe("https://shopinbox.example.com/api/auth/google/callback");
  });

  it("keeps explicit production redirect", () => {
    stashEnv(["NEXT_PUBLIC_APP_URL", "APP_URL"]);
    process.env.NEXT_PUBLIC_APP_URL = "https://shopinbox.example.com";
    expect(
      resolveOAuthRedirectUri(
        "https://custom.example/api/auth/google/callback",
        "/api/auth/google/callback",
      ),
    ).toBe("https://custom.example/api/auth/google/callback");
  });

  it("prefers APP_URL when NEXT_PUBLIC_APP_URL is still localhost", () => {
    stashEnv(["NEXT_PUBLIC_APP_URL", "APP_URL"]);
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.APP_URL = "https://shopinbox.n2.tinhgon.xyz";
    expect(getPublicAppUrl()).toBe("https://shopinbox.n2.tinhgon.xyz");
    expect(
      resolveOAuthRedirectUri(
        "http://localhost:3000/api/auth/google/callback",
        "/api/auth/google/callback",
      ),
    ).toBe("https://shopinbox.n2.tinhgon.xyz/api/auth/google/callback");
  });

  it("normalizes a bare production host into an https origin", () => {
    expect(normalizeAppOrigin("shopinboxn2.linhgunxy.xyz")).toBe(
      "https://shopinboxn2.linhgunxy.xyz",
    );
    stashEnv(["NEXT_PUBLIC_APP_URL", "APP_URL"]);
    process.env.NEXT_PUBLIC_APP_URL = "shopinbox.n2.tingon.xyz";
    delete process.env.APP_URL;
    expect(getPublicAppUrl()).toBe("https://shopinbox.n2.tingon.xyz");
  });

  it("rejects database URIs so shops never see postgres credentials", () => {
    expect(
      normalizeAppOrigin(
        "postgres://user:d70secret@vays-db.example:54322/shopinbox_db",
      ),
    ).toBeNull();
    stashEnv(["NEXT_PUBLIC_APP_URL", "APP_URL", "META_REDIRECT_URI"]);
    process.env.NEXT_PUBLIC_APP_URL =
      "postgres://user:d70secret@vays-db.example:54322/shopinbox_db";
    process.env.APP_URL = "https://shopinbox.n2.tinhgon.xyz";
    process.env.META_REDIRECT_URI =
      "postgres://user:d70secret@vays-db.example:54322/shopinbox_db";
    expect(getPublicAppUrl()).toBe("https://shopinbox.n2.tinhgon.xyz");
    expect(
      resolveOAuthRedirectUri(
        process.env.META_REDIRECT_URI,
        "/api/connect/meta/callback",
      ),
    ).toBe("https://shopinbox.n2.tinhgon.xyz/api/connect/meta/callback");
    expect(
      getMetaOAuthRedirectUri("https://shopinbox.n2.tinhgon.xyz"),
    ).toBe("https://shopinbox.n2.tinhgon.xyz/api/connect/meta/callback");
    expect(
      isUsableOAuthRedirectUri(
        "postgres://user:secret@vays-db.example:54322/shopinbox_db",
      ),
    ).toBe(false);
  });
});
