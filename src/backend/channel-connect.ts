import { prisma } from "@/backend/prisma";
import { openSecret, sealSecret } from "@/backend/token-crypto";
import {
  fetchRecentMetaConversations,
  subscribeMetaAppWebhook,
  subscribeMetaPageWebhook,
} from "@/backend/meta-oauth";
import { ingestRecentMetaMessages } from "@/backend/message-sync";
import { getMetaOAuthConfig, getMetaWebhookUrl } from "@/backend/oauth-config";
import type { Channel } from "@/lib/types";

type SaveOAuthConnectionInput = {
  shopId: string;
  channel: Channel;
  displayName: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  pageId?: string | null;
  oaId?: string | null;
  linkedPageId?: string | null;
  note?: string;
};

function metaGraphPageId(channel: Channel, pageId?: string | null, linkedPageId?: string | null) {
  if (channel === "instagram") {
    return linkedPageId ?? pageId ?? null;
  }
  return pageId ?? linkedPageId ?? null;
}

async function registerMetaWebhooks(input: {
  channel: Channel;
  accessToken: string;
  pageId?: string | null;
  linkedPageId?: string | null;
}) {
  const notes: string[] = [];
  const config = getMetaOAuthConfig();
  if (config?.webhookVerifyToken) {
    try {
      const subscribed = await subscribeMetaAppWebhook(config, getMetaWebhookUrl());
      notes.push(
        subscribed
          ? " Webhook app đã được đăng ký tự động."
          : " Cần dán Webhook URL trong Meta Developers (app chưa nhận callback).",
      );
    } catch {
      notes.push(" Không tự đăng ký webhook app được — dán URL trong Meta Developers.");
    }
  } else {
    notes.push(" Thiếu META_WEBHOOK_VERIFY_TOKEN — chưa tự đăng ký webhook app.");
  }

  const subscribePageId = metaGraphPageId(input.channel, input.pageId, input.linkedPageId);
  if (subscribePageId) {
    try {
      const subscribed = await subscribeMetaPageWebhook(subscribePageId, input.accessToken);
      notes.push(
        subscribed
          ? " Webhook page đã được đăng ký tự động."
          : " Cần đăng ký webhook page thủ công trong Meta Developers.",
      );
    } catch {
      notes.push(" Không tự đăng ký webhook page được — cấu hình thủ công trong Meta Developers.");
    }
  } else if (input.channel === "instagram") {
    notes.push(
      " Instagram dùng chung webhook Meta app — đăng ký Page liên kết IG trong Meta Developers.",
    );
  }

  return notes.join("");
}

export async function syncConnectedMetaInbox(shopId: string, channel: Channel) {
  if (channel !== "facebook" && channel !== "instagram") {
    throw new Error("Chỉ đồng bộ được Facebook hoặc Instagram.");
  }

  const account = await prisma.channelAccount.findUniqueOrThrow({
    where: { shopId_channel: { shopId, channel } },
  });

  if (account.status !== "ready" || !account.accessToken) {
    throw new Error("Kênh chưa kết nối OAuth.");
  }

  const accessToken = openSecret(account.accessToken);
  if (!accessToken) {
    throw new Error("Kênh chưa kết nối OAuth.");
  }

  const graphPageId = metaGraphPageId(channel, account.pageId, account.linkedPageId);
  if (!graphPageId || !account.pageId) {
    throw new Error("Thiếu Page ID trên kênh.");
  }

  const webhookNote = await registerMetaWebhooks({
    channel,
    accessToken,
    pageId: account.pageId,
    linkedPageId: account.linkedPageId,
  });

  const conversations = await fetchRecentMetaConversations(graphPageId, accessToken, {
    platform: channel === "instagram" ? "instagram" : "MESSENGER",
  });
  const ingested = await ingestRecentMetaMessages({
    channel,
    externalAccountId: account.pageId,
    pageIdsToSkip: [account.pageId, account.linkedPageId],
    conversations,
  });

  const ingestNote =
    ingested > 0
      ? ` Đã kéo ${ingested} tin nhắn gần đây vào Inbox.`
      : " Chưa có tin khách trong hội thoại gần đây — nhắn thử từ nick tester.";

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      note: `Đã kết nối OAuth — ${account.displayName ?? account.name}.${webhookNote}${ingestNote}`,
    },
  });

  return { ingested, webhookNote };
}

async function assertExternalAccountFree(input: SaveOAuthConnectionInput) {
  if (input.oaId) {
    const other = await prisma.channelAccount.findFirst({
      where: {
        channel: "zalo",
        oaId: input.oaId,
        status: "ready",
        shopId: { not: input.shopId },
      },
      select: { shopId: true },
    });
    if (other) {
      throw new Error("OA này đã được kết nối bởi shop khác.");
    }
  }

  const pageId = input.pageId ?? input.linkedPageId;
  if (pageId) {
    const other = await prisma.channelAccount.findFirst({
      where: {
        status: "ready",
        shopId: { not: input.shopId },
        OR: [{ pageId }, { linkedPageId: pageId }],
      },
      select: { shopId: true },
    });
    if (other) {
      throw new Error("Page này đã được kết nối bởi shop khác.");
    }
  }
}

export async function saveOAuthConnection(input: SaveOAuthConnectionInput) {
  await assertExternalAccountFree(input);
  const account = await prisma.channelAccount.findUniqueOrThrow({
    where: {
      shopId_channel: {
        shopId: input.shopId,
        channel: input.channel,
      },
    },
  });

  const webhookNote =
    input.channel === "zalo" ? " Đăng ký webhook URL trong Zalo OA Admin." : "";

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      status: "ready",
      displayName: input.displayName,
      accessToken: sealSecret(input.accessToken),
      refreshToken: input.refreshToken ? sealSecret(input.refreshToken) : null,
      expiresAt: input.expiresAt ?? null,
      pageId: input.pageId ?? account.pageId,
      linkedPageId: input.linkedPageId ?? account.linkedPageId,
      oaId: input.oaId ?? account.oaId,
      connectedAt: new Date(),
      note:
        input.note ??
        `Đã kết nối OAuth — ${input.displayName}.${webhookNote}`,
    },
  });

  if (input.channel === "facebook" || input.channel === "instagram") {
    try {
      await syncConnectedMetaInbox(input.shopId, input.channel);
    } catch (err) {
      // OAuth đã lưu token — ghi note để chủ shop biết bước tiếp (đồng bộ / webhook).
      const reason = err instanceof Error ? err.message : "không rõ lỗi";
      await prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          note: `Đã kết nối OAuth — ${input.displayName}. Đồng bộ Inbox lỗi: ${reason}. Bấm «Đồng bộ tin nhắn» hoặc kiểm tra webhook (docs/ket-noi-meta-fb-ig.md).`,
        },
      });
    }
  }
}

const CHANNEL_DRAFT_NAME: Record<Channel, string> = {
  facebook: "Facebook Messenger",
  instagram: "Instagram DM",
  zalo: "Zalo OA",
  web: "Chat website",
};

/** Đánh dấu đang OAuth; tạo nháp ChannelAccount nếu shop chưa có hàng cho kênh. */
export async function markChannelConnecting(shopId: string, channel: Channel) {
  const existing = await prisma.channelAccount.findUnique({
    where: { shopId_channel: { shopId, channel } },
  });

  if (existing) {
    await prisma.channelAccount.update({
      where: { id: existing.id },
      data: {
        status: "connecting",
        note: "Đang chờ hoàn tất OAuth...",
      },
    });
    return existing.id;
  }

  const created = await prisma.channelAccount.create({
    data: {
      id: `ch-${channel}-${crypto.randomUUID()}`,
      shopId,
      channel,
      name: CHANNEL_DRAFT_NAME[channel],
      status: "connecting",
      note: "Đang chờ hoàn tất OAuth...",
    },
  });
  return created.id;
}

/** Ngắt OAuth. Hội thoại/tin kênh này được ẩn khỏi Inbox (không xóa). */
export async function disconnectChannel(shopId: string, channel: Channel) {
  await prisma.channelAccount.update({
    where: {
      shopId_channel: { shopId, channel },
    },
    data: {
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      displayName: null,
      pageId: null,
      linkedPageId: null,
      oaId: null,
      expiresAt: null,
      connectedAt: null,
      lastWebhookAt: null,
      note: "Đã ngắt kết nối. Hội thoại kênh này ẩn khỏi Inbox đến khi nối lại.",
    },
  });
}
