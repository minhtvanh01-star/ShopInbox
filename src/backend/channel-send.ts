import {
  sendMetaMessage,
  sendMetaReaction,
  uploadMetaImageAttachment,
} from "@/backend/meta-oauth";
import { getZaloOAuthConfig } from "@/backend/oauth-config";
import { prisma } from "@/backend/prisma";
import { openSecret, sealSecret } from "@/backend/token-crypto";
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

function tokenPlain(value: string | null | undefined) {
  return openSecret(value);
}

function zaloNeedsRefresh(expiresAt: Date | null | undefined) {
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() < ZALO_REFRESH_SKEW_MS;
}

async function ensureZaloAccessToken(account: ChannelAccountRow & { accessToken: string }) {
  const current = tokenPlain(account.accessToken);
  if (!current) {
    throw new Error("Kênh Zalo chưa kết nối OAuth. Vào Cài đặt để nối lại trước khi gửi.");
  }

  if (!zaloNeedsRefresh(account.expiresAt)) {
    return current;
  }

  const latest = await prisma.channelAccount.findUnique({ where: { id: account.id } });
  if (latest?.accessToken && !zaloNeedsRefresh(latest.expiresAt)) {
    return tokenPlain(latest.accessToken) ?? current;
  }

  const refreshToken = tokenPlain(latest?.refreshToken ?? account.refreshToken);
  if (!refreshToken) {
    throw new Error("Token Zalo sắp hết hạn và không có refresh token. Kết nối lại kênh Zalo.");
  }

  const config = getZaloOAuthConfig();
  if (!config) {
    throw new Error("Chưa cấu hình Zalo OAuth trên server để làm mới token.");
  }

  try {
    const refreshed = await refreshZaloAccessToken(config, refreshToken);
    const saved = await prisma.channelAccount.updateMany({
      where: { id: account.id, refreshToken: latest?.refreshToken ?? account.refreshToken },
      data: {
        accessToken: sealSecret(refreshed.accessToken),
        refreshToken: sealSecret(refreshed.refreshToken),
        expiresAt: refreshed.expiresAt,
      },
    });
    if (saved.count === 0) {
      const winner = await prisma.channelAccount.findUnique({ where: { id: account.id } });
      const winnerToken = tokenPlain(winner?.accessToken);
      if (winnerToken) return winnerToken;
    }
    return refreshed.accessToken;
  } catch (error) {
    const winner = await prisma.channelAccount.findUnique({ where: { id: account.id } });
    if (winner?.accessToken && !zaloNeedsRefresh(winner.expiresAt)) {
      return tokenPlain(winner.accessToken) ?? current;
    }
    throw error;
  }
}

function metaSendPageId(account: ChannelAccountRow) {
  if (account.channel === "instagram") {
    return account.linkedPageId;
  }
  return account.pageId ?? account.linkedPageId;
}

function metaAccessToken(account: ChannelAccountRow & { accessToken: string }) {
  const token = tokenPlain(account.accessToken);
  if (!token) {
    throw new Error("Kênh Meta chưa kết nối OAuth. Vào Cài đặt để nối lại trước khi gửi.");
  }
  return token;
}

async function loadReadyAccount(shopId: string, channel: Channel) {
  const account = await prisma.channelAccount.findUnique({
    where: { shopId_channel: { shopId, channel } },
    include: { shop: { select: { suspendedAt: true } } },
  });
  if (!account || account.shop?.suspendedAt) return null;
  return account;
}

async function loadRecipientId(customerId: string, channel: Channel) {
  const identity = await prisma.customerIdentity.findUnique({
    where: { customerId_channel: { customerId, channel } },
  });
  return identity?.externalId?.trim() || null;
}

function oauthNotReadyMessage(channel: "facebook" | "instagram" | "zalo", action = "gửi") {
  if (channel === "zalo") {
    return `Kênh Zalo chưa kết nối OAuth. Vào Cài đặt để nối lại trước khi ${action}.`;
  }
  if (channel === "instagram") {
    return `Kênh Instagram chưa kết nối OAuth. Vào Cài đặt để nối lại trước khi ${action}.`;
  }
  return `Kênh Facebook chưa kết nối OAuth. Vào Cài đặt để nối lại trước khi ${action}.`;
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
    throw new Error(oauthNotReadyMessage(input.channel));
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
      accessToken: metaAccessToken(account),
      recipientId,
      text: input.text,
      channel: input.channel,
    });
    return { mode: "remote", externalMessageId: sent.externalMessageId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "lỗi không xác định";
    if (/Hết cửa sổ 24 giờ|chưa kết nối OAuth|Không tìm thấy ID khách|Thiếu Page ID/i.test(detail)) {
      throw err instanceof Error ? err : new Error(detail);
    }
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
    throw new Error(oauthNotReadyMessage(input.channel, "gửi ảnh"));
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

  const accessToken = metaAccessToken(account);

  try {
    const uploaded = await uploadMetaImageAttachment({
      pageId,
      accessToken,
      bytes: input.bytes,
      mimeType: input.mimeType,
      fileName: input.fileName,
    });
    const sent = await sendMetaMessage({
      pageId,
      accessToken,
      recipientId,
      attachmentId: uploaded.attachmentId,
      channel: input.channel,
    });
    return { mode: "remote", externalMessageId: sent.externalMessageId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "lỗi không xác định";
    if (/Hết cửa sổ 24 giờ|chưa kết nối OAuth|Không tìm thấy ID khách|Thiếu Page ID/i.test(detail)) {
      throw err instanceof Error ? err : new Error(detail);
    }
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
    throw new Error(oauthNotReadyMessage(input.channel, "gửi reaction"));
  }

  const recipientId = await loadRecipientId(input.customerId, input.channel);
  if (!recipientId) {
    throw new Error("Không tìm thấy ID khách trên kênh này. Không gửi được reaction.");
  }

  const pageId = metaSendPageId(account);
  if (!pageId) {
    throw new Error("Thiếu Page ID. Kết nối lại kênh Meta trước khi gửi reaction.");
  }

  await sendMetaReaction({
    pageId,
    accessToken: metaAccessToken(account),
    recipientId,
    messageId: input.externalMessageId,
    emoji: input.emoji,
  });
  return { mode: "remote" };
}
