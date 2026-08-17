"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { hasPermission, requirePermission } from "@/backend/rbac";
import { getSession } from "@/backend/session";
import {
  disconnectChannel,
  saveOAuthConnection,
  syncConnectedMetaInbox,
} from "@/backend/channel-connect";
import { pickMetaPageForChannel } from "@/backend/meta-oauth";
import {
  OAUTH_PAGES_COOKIE,
  verifyOAuthPagesToken,
} from "@/backend/oauth-state";
import type { PendingMetaPages } from "@/lib/oauth-types";
import { channelHasCredentials } from "@/lib/channels";
import { prisma } from "@/backend/prisma";
import { isMissingDbColumnError } from "@/backend/prisma-errors";
import type { Channel } from "@/lib/types";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";

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

export async function getPendingMetaPages(): Promise<PendingMetaPages | null> {
  const session = await getSession();
  if (!session || !(await hasPermission(session, PERMISSION_CODES.channelsConnect))) {
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

  // Không serialize pageAccessToken xuống RSC/client — token chỉ nằm trong cookie httpOnly.
  return {
    channel: payload.channel,
    pages: payload.pages.map(({ pageId, pageName, instagramId, instagramUsername }) => ({
      pageId,
      pageName,
      instagramId,
      instagramUsername,
    })),
  };
}

export async function completeMetaPageAction(
  _prev: CompleteMetaPageState,
  formData: FormData,
): Promise<CompleteMetaPageState> {
  const session = await requirePermission(PERMISSION_CODES.channelsConnect);
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
      linkedPageId: picked.linkedPageId,
    });
    jar.delete(OAUTH_PAGES_COOKIE);
    revalidatePath("/settings");
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.channelConnect,
      entityType: "ChannelAccount",
      metadata: { channel: payload.channel, displayName: picked.displayName, via: "meta_page_pick" },
    });
    return { success: `Đã kết nối ${picked.displayName}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không lưu được kết nối Meta." };
  }
}

export async function saveChannelCredentialsAction(
  _prev: SaveChannelCredentialsState,
  formData: FormData,
): Promise<SaveChannelCredentialsState> {
  const session = await requirePermission(PERMISSION_CODES.channelsConnect);

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

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.channelCredentialsSave,
    entityType: "ChannelAccount",
    entityId: account.id,
    metadata: { channel, ready },
  });

  return {
    success: ready
      ? "Đã lưu cấu hình. Kênh sẵn sàng (cần webhook để nhận tin nhắn)."
      : channel === "web"
        ? "Đã lưu nháp. Điền domain website để đánh dấu sẵn sàng."
        : "Đã lưu nháp. Nối OAuth (có access token) để kênh sẵn sàng gửi/nhận tin.",
  };
}

export type DisconnectChannelState = {
  error?: string;
  success?: string;
};

export async function disconnectChannelAction(
  _prev: DisconnectChannelState,
  formData: FormData,
): Promise<DisconnectChannelState> {
  const session = await requirePermission(PERMISSION_CODES.channelsConnect);
  const channel = formData.get("channel");
  if (typeof channel !== "string" || !CHANNELS.includes(channel as Channel)) {
    return { error: "Kênh không hợp lệ" };
  }

  try {
    await disconnectChannel(session.shopId, channel as Channel);
    revalidatePath("/settings");
    revalidatePath("/inbox");
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.channelDisconnect,
      entityType: "ChannelAccount",
      metadata: { channel },
    });
    return { success: "Đã ngắt kết nối kênh." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không ngắt được kết nối." };
  }
}

export type SyncMetaChannelState = {
  error?: string;
  success?: string;
};

export async function syncMetaChannelAction(
  _prev: SyncMetaChannelState,
  formData: FormData,
): Promise<SyncMetaChannelState> {
  const session = await requirePermission(PERMISSION_CODES.channelsConnect);
  const channel = formData.get("channel");
  if (channel !== "facebook" && channel !== "instagram") {
    return { error: "Chỉ đồng bộ được Facebook hoặc Instagram." };
  }

  try {
    const result = await syncConnectedMetaInbox(session.shopId, channel);
    revalidatePath("/settings");
    revalidatePath("/inbox");
    return {
      success:
        result.ingested > 0
          ? `Đã kéo ${result.ingested} tin nhắn vào Inbox. Gửi thêm tin mới để kiểm tra webhook.`
          : "Đã thử đăng ký webhook. Inbox chưa có tin khách — nhắn thử từ nick đã thêm làm Tester trên Meta app.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không đồng bộ được tin nhắn Meta." };
  }
}

export async function clearOAuthPagesCookie() {
  await requirePermission(PERMISSION_CODES.channelsConnect);
  const jar = await cookies();
  jar.delete(OAUTH_PAGES_COOKIE);
}

export type UpdateShopPolicyState = {
  error?: string;
  success?: string;
  replyClaimTtlMinutes?: number;
  maxUsersPerShop?: number;
};

export async function updateShopPolicyAction(
  _prev: UpdateShopPolicyState,
  formData: FormData,
): Promise<UpdateShopPolicyState> {
  const session = await requirePermission(PERMISSION_CODES.settingsUpdate);
  const { parseShopPolicyInput } = await import("@/lib/shop-policy");
  const parsed = parseShopPolicyInput({
    replyClaimTtlMinutes: formData.get("replyClaimTtlMinutes"),
    maxUsersPerShop: formData.get("maxUsersPerShop"),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  try {
    await prisma.shop.update({
      where: { id: session.shopId },
      data: {
        replyClaimTtlMinutes: parsed.policy.replyClaimTtlMinutes,
        maxUsersPerShop: parsed.policy.maxUsersPerShop,
      },
    });
  } catch (error) {
    if (
      isMissingDbColumnError(error, "replyClaimTtlMinutes") ||
      isMissingDbColumnError(error, "maxUsersPerShop")
    ) {
      return {
        error: "Cơ sở dữ liệu chưa migrate cột cấu hình shop. Chạy prisma migrate deploy rồi thử lại.",
      };
    }
    throw error;
  }

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.settingsUpdate,
    entityType: "Shop",
    entityId: session.shopId,
    metadata: {
      actorName: session.name,
      replyClaimTtlMinutes: parsed.policy.replyClaimTtlMinutes,
      maxUsersPerShop: parsed.policy.maxUsersPerShop,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/inbox");
  revalidatePath("/staff");

  return {
    success: "Đã lưu cấu hình vận hành.",
    replyClaimTtlMinutes: parsed.policy.replyClaimTtlMinutes,
    maxUsersPerShop: parsed.policy.maxUsersPerShop,
  };
}
