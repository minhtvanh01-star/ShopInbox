import {
  sendMetaMessage,
  sendMetaReaction,
  uploadMetaImageAttachment,
} from "@/backend/meta-oauth";
import { getZaloOAuthConfig } from "@/backend/oauth-config";
import { prisma } from "@/backend/prisma";
import { refreshZaloAccessToken, sendZaloOaMessage } from "@/backend/zalo-oauth";
import type { Channel } from "@/lib/types";

const ZALO_REFRESH_SKEW_MS = 5 * 60 * 1000;

type ChannelAccountRow = {
  id: string;
  channel: Channel;
  status: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  pageId: string | null;
  linkedPageId: string | null;
  oaId: string | null;
};

export type OutboundDispatchResult =
  | { mode: "local" }
  | { mode: "remote"; externalMessageId: string };

function isOAuthChannel(channel: Channel): channel is "facebook" | "instagram" | "zalo" {
  return channel === "facebook" || channel === "instagram" || channel === "zalo";
}

function accountReadyForRemote(account: ChannelAccountRow | null): account is ChannelAccountRow & {
  accessToken: string;
} {
  return Boolean(account && account.status === "ready" && account.accessToken);
}

async function ensureZaloAccessToken(account: ChannelAccountRow & { accessToken: string }) {
  const expiresAt = account.expiresAt?.getTime();
  const needsRefresh =
    typeof expiresAt === "number" && expiresAt - Date.now() < ZALO_REFRESH_SKEW_MS;

  if (!needsRefresh) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new Error("Token Zalo sắp hết hạn và không có refresh token. Kết nối lại kênh Zalo.");
  }

  const config = getZaloOAuthConfig();
  if (!config) {
    throw new Error("Chưa cấu hình Zalo OAuth trên server để làm mới token.");
  }

  const refreshed = await refreshZaloAccessToken(config, account.refreshToken);
  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    },
  });

  return refreshed.accessToken;
}

function metaSendPageId(account: ChannelAccountRow) {
  if (account.channel === "instagram") {
    return account.linkedPageId ?? account.pageId;
  }
  return account.pageId ?? account.linkedPageId;
}

async function loadReadyAccount(shopId: string, channel: Channel) {
  return prisma.channelAccount.findUnique({
    where: { shopId_channel: { shopId, channel } },
  });
}

async function loadRecipientId(customerId: string, channel: Channel) {
  const identity = await prisma.customerIdentity.findUnique({
    where: { customerId_channel: { customerId, channel } },
  });
  return identity?.externalId?.trim() || null;
}

/**
 * Gửi tin ra kênh ngoài nếu đã OAuth; web / demo (chưa token) chỉ báo local.
 * Ném Error tiếng Việt khi API thất bại — caller không ghi DB.
 */
export async function dispatchOutboundMessage(input: {
  shopId: string;
  channel: Channel;
  customerId: string;
  text: string;
}): Promise<OutboundDispatchResult> {
  if (!isOAuthChannel(input.channel)) {
    return { mode: "local" };
  }

  const account = await loadReadyAccount(input.shopId, input.channel);

  if (!accountReadyForRemote(account)) {
    return { mode: "local" };
  }

  const recipientId = await loadRecipientId(input.customerId, input.channel);
  if (!recipientId) {
    throw new Error(
      "Không tìm thấy ID khách trên kênh này. Cần tin nhắn inbound trước khi trả lời qua API.",
    );
  }

  try {
    if (input.channel === "zalo") {
      const accessToken = await ensureZaloAccessToken(account);
      const sent = await sendZaloOaMessage({
        accessToken,
        recipientId,
        text: input.text,
      });
      return { mode: "remote", externalMessageId: sent.externalMessageId };
    }

    const pageId = metaSendPageId(account);
    if (!pageId) {
      throw new Error(
        input.channel === "instagram"
          ? "Thiếu Page ID liên kết Instagram. Kết nối lại kênh Instagram."
          : "Thiếu Page ID Facebook. Kết nối lại kênh Facebook.",
      );
    }

    const sent = await sendMetaMessage({
      pageId,
      accessToken: account.accessToken,
      recipientId,
      text: input.text,
    });
    return { mode: "remote", externalMessageId: sent.externalMessageId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "lỗi không xác định";
    const label =
      input.channel === "zalo"
        ? "Zalo"
        : input.channel === "instagram"
          ? "Instagram"
          : "Facebook";
    throw new Error(`Gửi tin ${label} thất bại: ${detail}`);
  }
}

/** Gửi ảnh qua Meta (FB/IG). Zalo / web → báo lỗi rõ (không lưu “ảo” chỉ trong Inbox). */
export async function dispatchOutboundImage(input: {
  shopId: string;
  channel: Channel;
  customerId: string;
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<OutboundDispatchResult> {
  if (input.channel === "zalo") {
    throw new Error("Chưa hỗ trợ gửi ảnh qua Zalo. Hãy gửi tin nhắn chữ.");
  }
  if (input.channel !== "facebook" && input.channel !== "instagram") {
    return { mode: "local" };
  }

  const account = await loadReadyAccount(input.shopId, input.channel);
  if (!accountReadyForRemote(account)) {
    return { mode: "local" };
  }

  const recipientId = await loadRecipientId(input.customerId, input.channel);
  if (!recipientId) {
    throw new Error(
      "Không tìm thấy ID khách trên kênh này. Cần tin nhắn inbound trước khi gửi ảnh.",
    );
  }

  const pageId = metaSendPageId(account);
  if (!pageId) {
    throw new Error("Thiếu Page ID. Kết nối lại kênh Meta.");
  }

  try {
    const uploaded = await uploadMetaImageAttachment({
      pageId,
      accessToken: account.accessToken,
      bytes: input.bytes,
      mimeType: input.mimeType,
      fileName: input.fileName,
    });
    const sent = await sendMetaMessage({
      pageId,
      accessToken: account.accessToken,
      recipientId,
      attachmentId: uploaded.attachmentId,
    });
    return { mode: "remote", externalMessageId: sent.externalMessageId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "lỗi không xác định";
    throw new Error(`Gửi ảnh thất bại: ${detail}`);
  }
}

export async function dispatchOutboundReaction(input: {
  shopId: string;
  channel: Channel;
  customerId: string;
  externalMessageId: string;
  emoji: string | null;
}): Promise<{ mode: "local" | "remote" }> {
  if (input.channel !== "facebook" && input.channel !== "instagram") {
    return { mode: "local" };
  }

  const account = await loadReadyAccount(input.shopId, input.channel);
  if (!accountReadyForRemote(account)) {
    return { mode: "local" };
  }

  const recipientId = await loadRecipientId(input.customerId, input.channel);
  if (!recipientId) {
    return { mode: "local" };
  }

  const pageId = metaSendPageId(account);
  if (!pageId) {
    return { mode: "local" };
  }

  await sendMetaReaction({
    pageId,
    accessToken: account.accessToken,
    recipientId,
    messageId: input.externalMessageId,
    emoji: input.emoji,
  });
  return { mode: "remote" };
}
