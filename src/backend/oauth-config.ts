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

/** Env bắt buộc để nút OAuth Meta (Facebook/Instagram) hoạt động. */
export const META_OAUTH_REQUIRED_ENV = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_REDIRECT_URI",
] as const;

/** Env bắt buộc để nút OAuth Zalo hoạt động. */
export const ZALO_OAUTH_REQUIRED_ENV = [
  "ZALO_APP_ID",
  "ZALO_APP_SECRET",
  "ZALO_REDIRECT_URI",
] as const;

function envMissing(name: string) {
  return !process.env[name]?.trim();
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
    redirectUri: process.env.META_REDIRECT_URI!.trim(),
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
    redirectUri: process.env.ZALO_REDIRECT_URI!.trim(),
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
