import type { MetaOAuthConfig } from "@/backend/oauth-config";
import type { MetaPageOption } from "@/lib/oauth-types";
import type { Channel } from "@/lib/types";

const GRAPH_VERSION = "v21.0";

/** Quyền Page/Messenger — dùng Facebook Login. Không gộp Instagram scopes đã deprecated/invalid. */
const META_PAGE_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
] as const;

/**
 * Scope theo kênh. Instagram DM vẫn qua Fanpage liên kết IG Business —
 * Graph `instagram_business_account` lấy được với quyền Page (không cần
 * `instagram_basic` / `instagram_manage_messages` — Meta báo Invalid Scopes).
 */
export function metaScopesForChannel(channel: Channel = "facebook") {
  void channel;
  return META_PAGE_SCOPES.join(",");
}

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

export function buildMetaOAuthUrl(
  config: MetaOAuthConfig,
  state: string,
  channel: Channel = "facebook",
) {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", metaScopesForChannel(channel));
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

const META_PAGE_WEBHOOK_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_deliveries",
  "message_reads",
  "message_reactions",
] as const;

export async function subscribeMetaPageWebhook(pageId: string, pageAccessToken: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/subscribed_apps`);
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscribed_fields: [...META_PAGE_WEBHOOK_FIELDS],
    }),
  });

  const data = await readJson<{ success?: boolean }>(response);
  return Boolean(data.success);
}

/**
 * Đăng ký callback URL cấp app (Graph `{app-id}/subscriptions`).
 * `subscribed_apps` trên Page chỉ gửi event tới app — thiếu bước này thì Inbox không nhận tin.
 */
export async function subscribeMetaAppWebhook(config: MetaOAuthConfig, callbackUrl: string) {
  if (!config.webhookVerifyToken) {
    return false;
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${config.appId}/subscriptions`);
  url.searchParams.set("access_token", `${config.appId}|${config.appSecret}`);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      object: "page",
      callback_url: callbackUrl,
      fields: META_PAGE_WEBHOOK_FIELDS.join(","),
      verify_token: config.webhookVerifyToken,
    }),
  });

  const data = await readJson<{ success?: boolean }>(response);
  return Boolean(data.success);
}

export type MetaConversation = {
  id?: string;
  messages?: {
    data?: Array<{
      id?: string;
      message?: string;
      created_time?: string;
      from?: { id?: string; name?: string };
    }>;
  };
};

type MetaConversationsResponse = {
  data?: MetaConversation[];
  error?: { message: string };
};

export type MetaInboundHistoryMessage = {
  senderExternalId: string;
  senderName?: string;
  text: string;
  externalMessageId?: string;
  sentAt?: Date;
};

export function inboundMessagesFromMetaConversations(
  conversations: MetaConversation[],
  pageIdsToSkip: Array<string | null | undefined>,
): MetaInboundHistoryMessage[] {
  const skip = new Set(pageIdsToSkip.filter((id): id is string => Boolean(id)));
  const inbound: MetaInboundHistoryMessage[] = [];

  for (const conversation of conversations) {
    const chronological = [...(conversation.messages?.data ?? [])].reverse();
    for (const message of chronological) {
      const fromId = message.from?.id;
      const text = message.message?.trim();
      if (!fromId || !text || skip.has(fromId)) continue;

      inbound.push({
        senderExternalId: fromId,
        senderName: message.from?.name,
        text,
        externalMessageId: message.id,
        sentAt: message.created_time ? new Date(message.created_time) : undefined,
      });
    }
  }

  return inbound;
}

export async function fetchRecentMetaConversations(
  pageId: string,
  pageAccessToken: string,
  options?: { platform?: "MESSENGER" | "instagram"; limit?: number },
) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/conversations`);
  url.searchParams.set("platform", options?.platform ?? "MESSENGER");
  url.searchParams.set("limit", String(options?.limit ?? 15));
  url.searchParams.set(
    "fields",
    "participants,updated_time,messages.limit(20){id,message,from,created_time}",
  );
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url.toString());
  const data = await readJson<MetaConversationsResponse>(response);
  return data.data ?? [];
}

type MetaSendResponse = {
  recipient_id?: string;
  message_id?: string;
  error?: { message?: string; code?: number };
};

type MetaAttachmentUploadResponse = {
  attachment_id?: string;
  error?: { message?: string };
};

/** Gửi tin Messenger / Instagram DM qua Graph Send API (Page access token). */
export async function sendMetaMessage(input: {
  pageId: string;
  accessToken: string;
  recipientId: string;
  text?: string;
  attachmentId?: string;
  imageUrl?: string;
}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${input.pageId}/messages`);
  url.searchParams.set("access_token", input.accessToken);

  let message: Record<string, unknown>;
  if (input.attachmentId) {
    message = {
      attachment: {
        type: "image",
        payload: { attachment_id: input.attachmentId },
      },
    };
  } else if (input.imageUrl) {
    message = {
      attachment: {
        type: "image",
        payload: { url: input.imageUrl, is_reusable: true },
      },
    };
  } else if (input.text?.trim()) {
    message = { text: input.text.trim() };
  } else {
    throw new Error("Thiếu nội dung tin nhắn Meta.");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: input.recipientId },
      messaging_type: "RESPONSE",
      message,
    }),
  });

  const data = await readJson<MetaSendResponse>(response);
  if (!data.message_id) {
    throw new Error(data.error?.message ?? "Meta không trả về message_id");
  }

  return { externalMessageId: data.message_id };
}

/** Upload ảnh lên Meta → attachment_id (không cần URL công khai khi gửi). */
export async function uploadMetaImageAttachment(input: {
  pageId: string;
  accessToken: string;
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}) {
  const url = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${input.pageId}/message_attachments`,
  );
  url.searchParams.set("access_token", input.accessToken);

  const form = new FormData();
  form.set(
    "message",
    JSON.stringify({
      attachment: {
        type: "image",
        payload: { is_reusable: true },
      },
    }),
  );
  form.set(
    "filedata",
    new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }),
    input.fileName,
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    body: form,
  });
  const data = await readJson<MetaAttachmentUploadResponse>(response);
  if (!data.attachment_id) {
    throw new Error(data.error?.message ?? "Meta không trả về attachment_id");
  }
  return { attachmentId: data.attachment_id };
}

const META_REACTION_MAP: Record<string, string> = {
  "👍": "like",
  "❤️": "love",
  "😂": "laugh",
  "😮": "wow",
  "😢": "sorry",
  "🙏": "other",
};

export function metaReactionAction(emoji: string): string {
  return META_REACTION_MAP[emoji] ?? "other";
}

/** Gửi / gỡ reaction trên tin Messenger (cần mid). */
export async function sendMetaReaction(input: {
  pageId: string;
  accessToken: string;
  recipientId: string;
  messageId: string;
  emoji: string | null;
}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${input.pageId}/messages`);
  url.searchParams.set("access_token", input.accessToken);

  const body =
    input.emoji === null
      ? {
          recipient: { id: input.recipientId },
          sender_action: "unreact",
          payload: { message_id: input.messageId },
        }
      : {
          recipient: { id: input.recipientId },
          sender_action: "react",
          payload: {
            message_id: input.messageId,
            reaction: metaReactionAction(input.emoji),
          },
        };

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await readJson<{ recipient_id?: string; error?: { message?: string } }>(response);
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  return { ok: true as const };
}
