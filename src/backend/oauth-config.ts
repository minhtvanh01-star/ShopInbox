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

/** Env bắt buộc để nút OAuth Meta (Facebook/Instagram) hoạt động. Redirect có thể suy từ NEXT_PUBLIC_APP_URL. */
export const META_OAUTH_REQUIRED_ENV = ["META_APP_ID", "META_APP_SECRET"] as const;

/** Env bắt buộc để nút OAuth Zalo hoạt động. */
export const ZALO_OAUTH_REQUIRED_ENV = ["ZALO_APP_ID", "ZALO_APP_SECRET"] as const;

function envMissing(name: string) {
  return !process.env[name]?.trim();
}

function isLocalhostUrl(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
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
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Ưu tiên URL production từ NEXT_PUBLIC_APP_URL khi biến redirect vẫn còn localhost
 * (lỗi thường gặp trên Railway khi copy .env local).
 */
export function resolveOAuthRedirectUri(
  explicitEnv: string | undefined,
  callbackPath: string,
) {
  const path = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  const explicit = explicitEnv?.trim() ?? "";
  const publicUrl = getPublicAppUrl();
  const fromPublic = `${publicUrl}${path}`;

  if (explicit && !(isLocalhostUrl(explicit) && !isLocalhostUrl(publicUrl))) {
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

/** Callback OAuth Meta — suy từ NEXT_PUBLIC_APP_URL nếu META_REDIRECT_URI trống / localhost lệch. */
export function getMetaOAuthRedirectUri() {
  return resolveOAuthRedirectUri(
    process.env.META_REDIRECT_URI,
    "/api/connect/meta/callback",
  );
}

/** Callback OAuth Zalo — suy từ NEXT_PUBLIC_APP_URL nếu ZALO_REDIRECT_URI trống / localhost lệch. */
export function getZaloOAuthRedirectUri() {
  return resolveOAuthRedirectUri(
    process.env.ZALO_REDIRECT_URI,
    "/api/connect/zalo/callback",
  );
}

export function getMetaOAuthConfig(): MetaOAuthConfig | null {
  if (listMissingMetaOAuthEnvVars().length > 0) {
    return null;
  }

  return {
    appId: process.env.META_APP_ID!.trim(),
    appSecret: process.env.META_APP_SECRET!.trim(),
    redirectUri: getMetaOAuthRedirectUri(),
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "",
  };
}

export function getZaloOAuthConfig(): ZaloOAuthConfig | null {
  if (listMissingZaloOAuthEnvVars().length > 0) {
    return null;
  }

  return {
    appId: process.env.ZALO_APP_ID!.trim(),
    appSecret: process.env.ZALO_APP_SECRET!.trim(),
    redirectUri: getZaloOAuthRedirectUri(),
  };
}

export function getPublicAppUrl() {
  return (
    normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeAppOrigin(process.env.APP_URL) ||
    "http://localhost:3000"
  );
}

export function getMetaWebhookUrl() {
  return `${getPublicAppUrl()}/api/webhooks/meta`;
}

export function getZaloWebhookUrl() {
  return `${getPublicAppUrl()}/api/webhooks/zalo`;
}

export function getWebWidgetScriptUrl() {
  return `${getPublicAppUrl()}/widget.js`;
}
