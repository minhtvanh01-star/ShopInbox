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

export function getMetaOAuthConfig(): MetaOAuthConfig | null {
  if (listMissingMetaOAuthEnvVars().length > 0) {
    return null;
  }

  return {
    appId: process.env.META_APP_ID!.trim(),
    appSecret: process.env.META_APP_SECRET!.trim(),
    redirectUri: resolveOAuthRedirectUri(
      process.env.META_REDIRECT_URI,
      "/api/connect/meta/callback",
    ),
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
    redirectUri: resolveOAuthRedirectUri(
      process.env.ZALO_REDIRECT_URI,
      "/api/connect/zalo/callback",
    ),
  };
}

export function getPublicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getMetaWebhookUrl() {
  return `${getPublicAppUrl()}/api/webhooks/meta`;
}

export function getZaloWebhookUrl() {
  return `${getPublicAppUrl()}/api/webhooks/zalo`;
}
