import type { MetaOAuthConfig } from "@/backend/oauth-config";
import type { MetaPageOption } from "@/lib/oauth-types";
import type { Channel } from "@/lib/types";

const GRAPH_VERSION = "v21.0";
const META_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
].join(",");

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type MetaAccountsResponse = {
  data?: Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: {
      id: string;
      username?: string;
    };
  }>;
  error?: { message: string };
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: { message?: string } }).error?.message === "string"
        ? (body as { error: { message: string } }).error.message
        : `Meta API lỗi (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export function buildMetaOAuthUrl(config: MetaOAuthConfig, state: string) {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeMetaCode(config: MetaOAuthConfig, code: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString());
  const data = await readJson<MetaTokenResponse>(response);
  if (!data.access_token) {
    throw new Error("Meta không trả về access token");
  }
  return data.access_token;
}

export async function exchangeMetaLongLivedToken(config: MetaOAuthConfig, shortToken: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);

  const response = await fetch(url.toString());
  const data = await readJson<MetaTokenResponse>(response);
  if (!data.access_token) {
    throw new Error("Meta không trả về long-lived token");
  }

  const expiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

  return { accessToken: data.access_token, expiresAt };
}

export async function fetchMetaPages(userAccessToken: string): Promise<MetaPageOption[]> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}",
  );
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url.toString());
  const data = await readJson<MetaAccountsResponse>(response);

  return (data.data ?? []).map((page) => ({
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    instagramId: page.instagram_business_account?.id,
    instagramUsername: page.instagram_business_account?.username,
  }));
}

export function filterMetaPagesForChannel(channel: Channel, pages: MetaPageOption[]) {
  if (channel === "facebook") {
    return pages;
  }
  return pages.filter((page) => page.instagramId);
}

export function pickMetaPageForChannel(channel: Channel, page: MetaPageOption) {
  if (channel === "facebook") {
    return {
      externalId: page.pageId,
      displayName: page.pageName,
      accessToken: page.pageAccessToken,
      linkedPageId: page.pageId,
    };
  }

  if (!page.instagramId) {
    throw new Error("Page này chưa liên kết Instagram Business");
  }

  const label = page.instagramUsername
    ? `@${page.instagramUsername}`
    : `Instagram ${page.instagramId}`;

  return {
    externalId: page.instagramId,
    displayName: label,
    accessToken: page.pageAccessToken,
    linkedPageId: page.pageId,
  };
}

export async function subscribeMetaPageWebhook(pageId: string, pageAccessToken: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/subscribed_apps`);
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscribed_fields: [
        "messages",
        "messaging_postbacks",
        "message_deliveries",
        "message_reads",
      ],
    }),
  });

  const data = await readJson<{ success?: boolean }>(response);
  return Boolean(data.success);
}

type MetaSendResponse = {
  recipient_id?: string;
  message_id?: string;
  error?: { message?: string; code?: number };
};

/** Gửi tin Messenger / Instagram DM qua Graph Send API (Page access token). */
export async function sendMetaMessage(input: {
  pageId: string;
  accessToken: string;
  recipientId: string;
  text: string;
}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${input.pageId}/messages`);
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: input.recipientId },
      messaging_type: "RESPONSE",
      message: { text: input.text },
    }),
  });

  const data = await readJson<MetaSendResponse>(response);
  if (!data.message_id) {
    throw new Error(data.error?.message ?? "Meta không trả về message_id");
  }

  return { externalMessageId: data.message_id };
}
