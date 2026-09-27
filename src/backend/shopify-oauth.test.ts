import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildShopifyOAuthUrl,
  getShopifyScopes,
  isShopifyOAuthTimestampFresh,
  normalizeShopifyShopDomain,
  verifyShopifyOAuthHmac,
  verifyShopifyWebhookHmac,
} from "@/backend/shopify-oauth";

describe("normalizeShopifyShopDomain", () => {
  it("accepts a myshopify host and strips scheme", () => {
    expect(normalizeShopifyShopDomain("https://Cuahang.myshopify.com/admin")).toBe(
      "cuahang.myshopify.com",
    );
    expect(normalizeShopifyShopDomain("cuahang")).toBe("cuahang.myshopify.com");
  });

  it("rejects custom domains and empty values", () => {
    expect(normalizeShopifyShopDomain("cuahang.vn")).toBeNull();
    expect(normalizeShopifyShopDomain("")).toBeNull();
    expect(normalizeShopifyShopDomain("https://evil.example/cuahang.myshopify.com")).toBeNull();
  });
});

describe("Shopify OAuth helpers", () => {
  it("builds an authorize URL for the shop", () => {
    const url = new URL(
      buildShopifyOAuthUrl(
        {
          apiKey: "key-1",
          apiSecret: "secret-1",
          redirectUri: "https://app.example/api/connect/shopify/callback",
          scopes: "read_customers",
        },
        "cuahang.myshopify.com",
        "state-1",
      ),
    );
    expect(url.origin).toBe("https://cuahang.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("key-1");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("scope")).toBe("read_customers");
  });

  it("defaults scopes when env is empty", () => {
    expect(getShopifyScopes("")).toBe("read_customers,read_orders");
    expect(getShopifyScopes("read_customers write_customers")).toBe(
      "read_customers,write_customers",
    );
  });

  it("verifies OAuth callback hmac", () => {
    const secret = "shpss_test";
    const params = new URLSearchParams({
      shop: "cuahang.myshopify.com",
      code: "abc",
      state: "s1",
      timestamp: "1710000000",
    });
    const message = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    params.set("hmac", createHmac("sha256", secret).update(message).digest("hex"));
    expect(verifyShopifyOAuthHmac(params, secret)).toBe(true);
    expect(verifyShopifyOAuthHmac(params, "wrong")).toBe(false);
  });

  it("accepts a fresh Shopify timestamp", () => {
    const now = 1_710_000_000_000;
    expect(isShopifyOAuthTimestampFresh(String(Math.floor(now / 1000)), now)).toBe(true);
    expect(isShopifyOAuthTimestampFresh("100", now)).toBe(false);
    expect(isShopifyOAuthTimestampFresh("", now)).toBe(false);
  });

  it("verifies webhook hmac", () => {
    const secret = "shpss_test";
    const body = `{"id":1}`;
    const header = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(verifyShopifyWebhookHmac(body, header, secret)).toBe(true);
    expect(verifyShopifyWebhookHmac(body, header, "wrong")).toBe(false);
  });
});
