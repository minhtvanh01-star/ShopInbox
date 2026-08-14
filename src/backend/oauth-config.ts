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

export function getMetaOAuthConfig(): MetaOAuthConfig | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  const webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";

  if (!appId || !appSecret || !redirectUri) {
    return null;
  }

  return { appId, appSecret, redirectUri, webhookVerifyToken };
}

export function getZaloOAuthConfig(): ZaloOAuthConfig | null {
  const appId = process.env.ZALO_APP_ID?.trim();
  const appSecret = process.env.ZALO_APP_SECRET?.trim();
  const redirectUri = process.env.ZALO_REDIRECT_URI?.trim();

  if (!appId || !appSecret || !redirectUri) {
    return null;
  }

  return { appId, appSecret, redirectUri };
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
