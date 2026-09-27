/**
 * Không import module Node-only (`node:crypto`, Prisma, …).
 * File này bị middleware Edge kéo qua `public-url` — `node:crypto` sẽ 500 trên VibeHost.
 */
export const SHOPIFY_DEFAULT_SCOPES = "read_customers,read_orders";

export function getShopifyScopes(raw = process.env.SHOPIFY_SCOPES) {
  const scopes = String(raw ?? "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes.join(",") : SHOPIFY_DEFAULT_SCOPES;
}

export type MetaOAuthConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  webhookVerifyToken: string;
};

export type ZaloOAuthConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
};

export type ShopifyOAuthConfig = {
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  scopes: string;
};

/** Env bắt buộc để nút OAuth Meta (Facebook/Instagram) hoạt động. Redirect có thể suy từ NEXT_PUBLIC_APP_URL. */
export const META_OAUTH_REQUIRED_ENV = ["META_APP_ID", "META_APP_SECRET"] as const;

/** Env bắt buộc để nút OAuth Zalo hoạt động. */
export const ZALO_OAUTH_REQUIRED_ENV = ["ZALO_APP_ID", "ZALO_APP_SECRET"] as const;

/** Env bắt buộc để nối Shopify Partner. */
export const SHOPIFY_OAUTH_REQUIRED_ENV = ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"] as const;

function envMissing(name: string) {
  return !process.env[name]?.trim();
}

function isLocalhostUrl(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

function isHttpOrHttpsUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Chấp nhận `https://host` hoặc host trần (thiếu scheme) — tránh `new URL` ném lỗi trong middleware. */
export function normalizeAppOrigin(value: string | undefined | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Ưu tiên URL production từ NEXT_PUBLIC_APP_URL khi biến redirect vẫn còn localhost
 * (lỗi thường gặp trên Railway khi copy .env local).
 */
export function isUsableOAuthRedirectUri(
  value: string,
  production = process.env.NODE_ENV === "production",
) {
  if (!isHttpOrHttpsUrl(value)) return false;
  if (production && isLocalhostUrl(value)) return false;
  return true;
}

export function resolveOAuthRedirectUri(
  explicitEnv: string | undefined,
  callbackPath: string,
  publicOrigin = getPublicAppUrl(),
) {
  const path = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  const explicit = explicitEnv?.trim() ?? "";
  const publicUrl = publicOrigin || getPublicAppUrl();
  const fromPublic = `${publicUrl}${path}`;

  if (
    explicit &&
    isUsableOAuthRedirectUri(explicit, false) &&
    !(isLocalhostUrl(explicit) && !isLocalhostUrl(publicUrl))
  ) {
    return explicit;
  }

  return fromPublic;
}

export function listMissingMetaOAuthEnvVars(): string[] {
  return META_OAUTH_REQUIRED_ENV.filter((name) => envMissing(name));
}

export function listMissingZaloOAuthEnvVars(): string[] {
  return ZALO_OAUTH_REQUIRED_ENV.filter((name) => envMissing(name));
}

export function listMissingShopifyOAuthEnvVars(): string[] {
  return SHOPIFY_OAUTH_REQUIRED_ENV.filter((name) => envMissing(name));
}

/** Callback OAuth Meta — suy từ NEXT_PUBLIC_APP_URL nếu META_REDIRECT_URI trống / localhost lệch. */
export function getMetaOAuthRedirectUri(publicOrigin?: string) {
  return resolveOAuthRedirectUri(
    process.env.META_REDIRECT_URI,
    "/api/connect/meta/callback",
    publicOrigin,
  );
}

/** Callback OAuth Zalo — suy từ NEXT_PUBLIC_APP_URL nếu ZALO_REDIRECT_URI trống / localhost lệch. */
export function getZaloOAuthRedirectUri(publicOrigin?: string) {
  return resolveOAuthRedirectUri(
    process.env.ZALO_REDIRECT_URI,
    "/api/connect/zalo/callback",
    publicOrigin,
  );
}

export function getMetaOAuthConfig(publicOrigin?: string): MetaOAuthConfig | null {
  if (listMissingMetaOAuthEnvVars().length > 0) {
    return null;
  }

  return {
    appId: process.env.META_APP_ID!.trim(),
    appSecret: process.env.META_APP_SECRET!.trim(),
    redirectUri: getMetaOAuthRedirectUri(publicOrigin),
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "",
  };
}

export function getZaloOAuthConfig(publicOrigin?: string): ZaloOAuthConfig | null {
  if (listMissingZaloOAuthEnvVars().length > 0) {
    return null;
  }

  return {
    appId: process.env.ZALO_APP_ID!.trim(),
    appSecret: process.env.ZALO_APP_SECRET!.trim(),
    redirectUri: getZaloOAuthRedirectUri(publicOrigin),
  };
}

export function getShopifyOAuthRedirectUri(publicOrigin?: string) {
  return resolveOAuthRedirectUri(
    process.env.SHOPIFY_REDIRECT_URI,
    "/api/connect/shopify/callback",
    publicOrigin,
  );
}

export function getShopifyOAuthConfig(publicOrigin?: string): ShopifyOAuthConfig | null {
  if (listMissingShopifyOAuthEnvVars().length > 0) {
    return null;
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY!.trim(),
    apiSecret: process.env.SHOPIFY_API_SECRET!.trim(),
    redirectUri: getShopifyOAuthRedirectUri(publicOrigin),
    scopes: getShopifyScopes(process.env.SHOPIFY_SCOPES),
  };
}

export function getPublicAppUrl() {
  const nextPublic = normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const appUrl = normalizeAppOrigin(process.env.APP_URL);
  if (nextPublic && !(isLocalhostUrl(nextPublic) && appUrl && !isLocalhostUrl(appUrl))) {
    return nextPublic;
  }
  return appUrl || nextPublic || "http://localhost:3000";
}

export function getMetaWebhookUrl() {
  return `${getPublicAppUrl()}/api/webhooks/meta`;
}

export function getZaloWebhookUrl() {
  return `${getPublicAppUrl()}/api/webhooks/zalo`;
}

export function getShopifyWebhookUrl(publicOrigin?: string) {
  const origin = (publicOrigin && normalizeAppOrigin(publicOrigin)) || getPublicAppUrl();
  return `${origin}/api/webhooks/shopify`;
}

export function getWebWidgetScriptUrl() {
  return `${getPublicAppUrl()}/widget.js`;
}
