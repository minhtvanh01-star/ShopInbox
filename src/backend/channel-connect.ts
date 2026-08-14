import { prisma } from "@/backend/prisma";
import { subscribeMetaPageWebhook } from "@/backend/meta-oauth";
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

export async function saveOAuthConnection(input: SaveOAuthConnectionInput) {
  const account = await prisma.channelAccount.findUniqueOrThrow({
    where: {
      shopId_channel: {
        shopId: input.shopId,
        channel: input.channel,
      },
    },
  });

  let webhookNote = "";
  if (input.channel === "facebook" || input.channel === "instagram") {
    const subscribePageId =
      input.channel === "instagram"
        ? input.linkedPageId ?? null
        : input.pageId ?? input.linkedPageId ?? null;
    if (subscribePageId) {
      try {
        const subscribed = await subscribeMetaPageWebhook(subscribePageId, input.accessToken);
        webhookNote = subscribed
          ? " Webhook page đã được đăng ký tự động."
          : " Cần đăng ký webhook thủ công trong Meta Developers.";
      } catch {
        webhookNote = " Không tự đăng ký webhook được — cấu hình thủ công trong Meta Developers.";
      }
    } else if (input.channel === "instagram") {
      webhookNote =
        " Instagram dùng chung webhook Meta app — đăng ký Page liên kết IG trong Meta Developers.";
    }
  } else if (input.channel === "zalo") {
    webhookNote = " Đăng ký webhook URL trong Zalo OA Admin.";
  }

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      status: "ready",
      displayName: input.displayName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
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
}

export async function markChannelConnecting(shopId: string, channel: Channel) {
  await prisma.channelAccount.updateMany({
    where: { shopId, channel },
    data: {
      status: "connecting",
      note: "Đang chờ hoàn tất OAuth...",
    },
  });
}

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
      note: "Đã ngắt kết nối. Bấm OAuth để kết nối lại.",
    },
  });
}
