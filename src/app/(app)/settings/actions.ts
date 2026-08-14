"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/backend/auth";
import { getSession } from "@/backend/session";
import { saveOAuthConnection } from "@/backend/channel-connect";
import { pickMetaPageForChannel } from "@/backend/meta-oauth";
import {
  OAUTH_PAGES_COOKIE,
  verifyOAuthPagesToken,
} from "@/backend/oauth-state";
import type { MetaPageOption } from "@/lib/oauth-types";
import { channelHasCredentials } from "@/lib/channels";
import { prisma } from "@/backend/prisma";
import type { Channel } from "@/lib/types";

export type SaveChannelCredentialsState = {
  error?: string;
  success?: string;
};

export type CompleteMetaPageState = {
  error?: string;
  success?: string;
};

const CHANNELS: Channel[] = ["facebook", "zalo", "instagram", "web"];

function pickField(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function getPendingMetaPages(): Promise<{
  channel: Channel;
  pages: MetaPageOption[];
} | null> {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return null;
  }
  const jar = await cookies();
  const token = jar.get(OAUTH_PAGES_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifyOAuthPagesToken(token);
  if (!payload || payload.shopId !== session.shopId) {
    return null;
  }

  return { channel: payload.channel, pages: payload.pages };
}

export async function completeMetaPageAction(
  _prev: CompleteMetaPageState,
  formData: FormData,
): Promise<CompleteMetaPageState> {
  const session = await requireOwner();
  const jar = await cookies();
  const token = jar.get(OAUTH_PAGES_COOKIE)?.value;
  if (!token) {
    return { error: "Phiên chọn trang đã hết hạn. Kết nối lại với Meta." };
  }

  const payload = await verifyOAuthPagesToken(token);
  if (!payload || payload.shopId !== session.shopId) {
    return { error: "Phiên chọn trang không hợp lệ." };
  }

  const pageId = pickField(formData, "pageId");
  if (!pageId) {
    return { error: "Chọn một Fanpage / Instagram Business." };
  }

  const page = payload.pages.find((item) => item.pageId === pageId);
  if (!page) {
    return { error: "Trang không nằm trong danh sách OAuth." };
  }

  try {
    const picked = pickMetaPageForChannel(payload.channel, page);
    await saveOAuthConnection({
      shopId: session.shopId,
      channel: payload.channel,
      displayName: picked.displayName,
      accessToken: picked.accessToken,
      pageId: picked.externalId,
    });
    jar.delete(OAUTH_PAGES_COOKIE);
    revalidatePath("/settings");
    return { success: `Đã kết nối ${picked.displayName}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không lưu được kết nối Meta." };
  }
}

export async function saveChannelCredentialsAction(
  _prev: SaveChannelCredentialsState,
  formData: FormData,
): Promise<SaveChannelCredentialsState> {
  const session = await requireOwner();

  const channel = formData.get("channel");
  if (typeof channel !== "string" || !CHANNELS.includes(channel as Channel)) {
    return { error: "Kênh không hợp lệ" };
  }

  const account = await prisma.channelAccount.findUnique({
    where: {
      shopId_channel: {
        shopId: session.shopId,
        channel: channel as Channel,
      },
    },
  });

  if (!account) {
    return { error: "Không tìm thấy kênh trong shop" };
  }

  const note = pickField(formData, "note") ?? account.note;
  const appId = pickField(formData, "appId");
  const appSecret = pickField(formData, "appSecret");
  const pageId = pickField(formData, "pageId");
  const webhookSecret = pickField(formData, "webhookSecret");
  const oaId = pickField(formData, "oaId");

  const next = {
    appId: appId ?? account.appId,
    appSecret: appSecret ?? account.appSecret,
    pageId: pageId ?? account.pageId,
    webhookSecret: webhookSecret ?? account.webhookSecret,
    oaId: oaId ?? account.oaId,
    accessToken: account.accessToken,
    displayName: account.displayName,
  };

  const ready = channelHasCredentials(channel as Channel, next);

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      note,
      appId: next.appId,
      appSecret: next.appSecret,
      pageId: next.pageId,
      webhookSecret: next.webhookSecret,
      oaId: next.oaId,
      status: ready ? "ready" : account.status === "connecting" ? "connecting" : "disconnected",
    },
  });

  revalidatePath("/settings");

  return {
    success: ready
      ? "Đã lưu cấu hình. Kênh sẵn sàng (cần webhook để nhận tin nhắn)."
      : "Đã lưu nháp. Hoàn tất OAuth hoặc điền đủ trường bắt buộc.",
  };
}

export async function clearOAuthPagesCookie() {
  const jar = await cookies();
  jar.delete(OAUTH_PAGES_COOKIE);
}
