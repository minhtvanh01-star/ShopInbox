import { createHmac, timingSafeEqual } from "node:crypto";
import type { ShopifyOAuthConfig } from "@/backend/oauth-config";

export { getShopifyScopes, SHOPIFY_DEFAULT_SCOPES } from "@/backend/oauth-config";

export const SHOPIFY_API_VERSION = "2024-10";

const SHOP_HOST_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShopifyShopDomain(raw: string | undefined | null) {
  const trimmed = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!trimmed) return null;
  const host = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return SHOP_HOST_RE.test(host) ? host : null;
}

export function buildShopifyOAuthUrl(
  config: ShopifyOAuthConfig,
  shopDomain: string,
  state: string,
) {
  const shop = normalizeShopifyShopDomain(shopDomain);
  if (!shop) {
    throw new Error("Domain Shopify không hợp lệ.");
  }
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", config.apiKey);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

function equalHex(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** HMAC query trên callback OAuth (Shopify gửi `hmac`). */
export function verifyShopifyOAuthHmac(
  searchParams: URLSearchParams,
  apiSecret: string,
) {
  const hmac = searchParams.get("hmac")?.trim() ?? "";
  if (!hmac || !apiSecret.trim()) return false;
  const pairs = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = createHmac("sha256", apiSecret).update(pairs).digest("hex");
  return equalHex(digest, hmac);
}

/** HMAC body webhook (`X-Shopify-Hmac-Sha256`, base64). */
export function verifyShopifyWebhookHmac(rawBody: string, header: string | null, apiSecret: string) {
  const received = header?.trim() ?? "";
  if (!received || !apiSecret.trim()) return false;
  const digest = createHmac("sha256", apiSecret).update(rawBody, "utf8").digest("base64");
  return equalHex(digest, received);
}

export async function exchangeShopifyCode(
  config: ShopifyOAuthConfig,
  shopDomain: string,
  code: string,
) {
  const shop = normalizeShopifyShopDomain(shopDomain);
  if (!shop) {
    throw new Error("Domain Shopify không hợp lệ.");
  }
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code,
    }),
  });
  const data = (await response.json()) as { access_token?: string; scope?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error || "Shopify không trả access token.");
  }
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

export async function fetchShopifyShopName(shopDomain: string, accessToken: string) {
  const shop = normalizeShopifyShopDomain(shopDomain);
  if (!shop) return shopDomain;
  try {
    const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!response.ok) return shop;
    const data = (await response.json()) as { shop?: { name?: string } };
    return data.shop?.name?.trim() || shop;
  } catch {
    return shop;
  }
}

export function isShopifyOAuthTimestampFresh(
  timestamp: string | null | undefined,
  nowMs = Date.now(),
  maxAgeMs = 5 * 60 * 1000,
) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  return Math.abs(nowMs - tsMs) <= maxAgeMs;
}

export async function registerShopifyAppUninstalledWebhook(input: {
  shopDomain: string;
  accessToken: string;
  address: string;
}) {
  const shop = normalizeShopifyShopDomain(input.shopDomain);
  if (!shop) return false;
  const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": input.accessToken,
    },
    body: JSON.stringify({
      webhook: {
        topic: "app/uninstalled",
        address: input.address,
        format: "json",
      },
    }),
  });
  if (response.ok) return true;
  if (response.status !== 422) return false;
  const body = await response.text();
  return /already been taken|already exists/i.test(body);
}
