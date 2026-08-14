import { prisma } from "@/backend/prisma";
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

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      status: "ready",
      displayName: input.displayName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
      pageId: input.pageId ?? account.pageId,
      oaId: input.oaId ?? account.oaId,
      note:
        input.note ??
        `Đã kết nối OAuth — ${input.displayName}. Cấu hình webhook trong Meta/Zalo Developers.`,
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
