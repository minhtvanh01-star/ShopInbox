"use server";

/** Server mutations (inbox/orders). Tạm cạnh route đến khi Lát 3 ổn định. */
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import {
  dispatchOutboundImage,
  dispatchOutboundMessage,
  dispatchOutboundReaction,
} from "@/backend/channel-send";
import { isReplyClaimActive } from "@/backend/reply-claim";
import { isAdminSession, requirePermission } from "@/backend/rbac";
import { nextOrderCode, normalizeOrderItems, type DraftOrderItem } from "@/backend/order-code";
import {
  removeMessageReaction,
  upsertMessageReaction,
} from "@/backend/message-sync";
import { prisma } from "@/backend/prisma";
import { saveShopImageUpload } from "@/backend/upload-store";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import type { ConversationTag, OrderStatus } from "@/lib/types";

export const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

function assertCanReply(input: {
  staffId: string | null;
  replyClaimedAt: Date | null;
  currentStaffId: string;
  isAdmin?: boolean;
}) {
  if (input.isAdmin) {
    return;
  }
  if (!input.staffId || !isReplyClaimActive(input.replyClaimedAt)) {
    throw new Error('Hãy bấm "Tôi trả lời" trước khi gửi tin.');
  }
  if (input.staffId !== input.currentStaffId) {
    throw new Error("Hội thoại đang được nhân viên khác trả lời.");
  }
}

export async function claimConversation(conversationId: string) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
  const admin = isAdminSession(session);
  if (!conversationId) {
    throw new Error("Thiếu hội thoại");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
    include: {
      staff: { select: { name: true } },
      customer: { select: { name: true } },
    },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  if (
    !admin &&
    conversation.staffId &&
    conversation.staffId !== session.staffId &&
    isReplyClaimActive(conversation.replyClaimedAt)
  ) {
    throw new Error(
      `${conversation.staff?.name ?? "Nhân viên khác"} đang trả lời hội thoại này.`,
    );
  }

  const claimedAt = new Date();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      staffId: session.staffId,
      replyClaimedAt: claimedAt,
    },
  });

  revalidatePath("/inbox");

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.conversationClaim,
    entityType: "Conversation",
    entityId: conversationId,
    metadata: {
      actorName: session.name,
      channel: conversation.channel,
      customerName: conversation.customer.name,
      reason: admin && conversation.staffId && conversation.staffId !== session.staffId
        ? "admin_takeover"
        : "manual",
    },
  });

  return { ok: true as const, claimedAt: claimedAt.toISOString() };
}

export async function releaseConversation(
  conversationId: string,
  reason: "manual" | "idle_timeout" = "manual",
) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
  const admin = isAdminSession(session);
  if (!conversationId) {
    throw new Error("Thiếu hội thoại");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
    select: {
      id: true,
      staffId: true,
      replyClaimedAt: true,
      channel: true,
      customer: { select: { name: true } },
    },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  if (
    !admin &&
    conversation.staffId &&
    conversation.staffId !== session.staffId &&
    isReplyClaimActive(conversation.replyClaimedAt)
  ) {
    throw new Error("Chỉ người đang trả lời mới nhả được hội thoại.");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      staffId: null,
      replyClaimedAt: null,
    },
  });

  revalidatePath("/inbox");

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.conversationRelease,
    entityType: "Conversation",
    entityId: conversationId,
    metadata: {
      actorName: session.name,
      channel: conversation.channel,
      customerName: conversation.customer.name,
      reason: admin && conversation.staffId !== session.staffId ? `admin_${reason}` : reason,
    },
  });

  return { ok: true as const };
}

/** Gia hạn claim khi đang gõ / còn dùng — tránh timeout vì idle. */
export async function touchConversationClaim(conversationId: string) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
  const admin = isAdminSession(session);
  if (!conversationId) {
    throw new Error("Thiếu hội thoại");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
    select: { id: true, staffId: true, replyClaimedAt: true },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  if (
    !admin &&
    (conversation.staffId !== session.staffId || !isReplyClaimActive(conversation.replyClaimedAt))
  ) {
    throw new Error("Bạn không còn giữ hội thoại này.");
  }

  const claimedAt = new Date();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      staffId: session.staffId,
      replyClaimedAt: claimedAt,
    },
  });

  // Không revalidatePath — tránh nhảy UI khi đang gõ; client tự cập nhật claimedAt.
  return { ok: true as const, claimedAt: claimedAt.toISOString() };
}

export async function sendMessage(conversationId: string, text: string) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
  const admin = isAdminSession(session);
  const body = text.trim();
  if (!conversationId || !body) {
    throw new Error("Tin nhắn không hợp lệ");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  assertCanReply({
    staffId: conversation.staffId,
    replyClaimedAt: conversation.replyClaimedAt,
    currentStaffId: session.staffId,
    isAdmin: admin,
  });

  const outbound = await dispatchOutboundMessage({
    shopId: session.shopId,
    channel: conversation.channel,
    customerId: conversation.customerId,
    text: body,
  });

  const createdAt = new Date();
  const message = await prisma.message.create({
    data: {
      shopId: session.shopId,
      conversationId,
      staffId: session.staffId,
      sender: "shop",
      text: body,
      externalMessageId: outbound.mode === "remote" ? outbound.externalMessageId : null,
      createdAt,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: body,
      lastAt: createdAt,
      unread: 0,
      // Gia hạn claim khi đang trả lời
      replyClaimedAt: createdAt,
      staffId: session.staffId,
    },
  });

  revalidatePath("/inbox");

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.messageSend,
    entityType: "Message",
    entityId: message.id,
    metadata: {
      conversationId,
      channel: conversation.channel,
      mode: outbound.mode,
      actorName: session.name,
      textLength: body.length,
    },
  });

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    attachmentType: null,
    attachmentUrl: null,
    attachmentName: null,
    externalMessageId: message.externalMessageId,
    reactions: [],
  };
}

export async function sendImageMessage(conversationId: string, formData: FormData) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
  const admin = isAdminSession(session);
  if (!conversationId) {
    throw new Error("Thiếu hội thoại");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Chọn một ảnh để gửi.");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  assertCanReply({
    staffId: conversation.staffId,
    replyClaimedAt: conversation.replyClaimedAt,
    currentStaffId: session.staffId,
    isAdmin: admin,
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await saveShopImageUpload({
    shopId: session.shopId,
    bytes,
    mimeType: file.type || "image/jpeg",
    originalName: file.name,
  });

  const outbound = await dispatchOutboundImage({
    shopId: session.shopId,
    channel: conversation.channel,
    customerId: conversation.customerId,
    bytes,
    mimeType: saved.mimeType,
    fileName: saved.fileName,
  });

  const createdAt = new Date();
  const caption = String(formData.get("caption") ?? "").trim();
  const text = caption || "[Ảnh]";

  const message = await prisma.message.create({
    data: {
      shopId: session.shopId,
      conversationId,
      staffId: session.staffId,
      sender: "shop",
      text,
      attachmentType: "image",
      attachmentUrl: saved.publicPath,
      attachmentName: saved.fileName,
      externalMessageId: outbound.mode === "remote" ? outbound.externalMessageId : null,
      createdAt,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: text,
      lastAt: createdAt,
      unread: 0,
      replyClaimedAt: createdAt,
      staffId: session.staffId,
    },
  });

  revalidatePath("/inbox");

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.messageSend,
    entityType: "Message",
    entityId: message.id,
    metadata: {
      conversationId,
      channel: conversation.channel,
      mode: outbound.mode,
      actorName: session.name,
      hasImage: true,
      attachmentName: saved.fileName,
    },
  });

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    attachmentType: message.attachmentType,
    attachmentUrl: message.attachmentUrl,
    attachmentName: message.attachmentName,
    externalMessageId: message.externalMessageId,
    reactions: [],
  };
}

export async function reactToMessage(messageId: string, emoji: string) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
  const admin = isAdminSession(session);
  if (!messageId || !emoji.trim()) {
    throw new Error("Reaction không hợp lệ");
  }
  if (!(QUICK_REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    throw new Error("Emoji reaction không được hỗ trợ.");
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, shopId: session.shopId },
    include: {
      conversation: {
        select: {
          id: true,
          channel: true,
          customerId: true,
          staffId: true,
          replyClaimedAt: true,
        },
      },
    },
  });
  if (!message) {
    throw new Error("Không tìm thấy tin nhắn");
  }

  assertCanReply({
    staffId: message.conversation.staffId,
    replyClaimedAt: message.conversation.replyClaimedAt,
    currentStaffId: session.staffId,
    isAdmin: admin,
  });

  const reactorKey = `staff:${session.staffId}`;
  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_reactorKey: { messageId, reactorKey },
    },
  });

  let nextEmoji: string | null = emoji;
  if (existing?.emoji === emoji) {
    await removeMessageReaction(messageId, reactorKey);
    nextEmoji = null;
  } else {
    await upsertMessageReaction({
      shopId: session.shopId,
      messageId,
      reactorKey,
      emoji,
      staffId: session.staffId,
    });
  }

  if (message.externalMessageId) {
    try {
      await dispatchOutboundReaction({
        shopId: session.shopId,
        channel: message.conversation.channel,
        customerId: message.conversation.customerId,
        externalMessageId: message.externalMessageId,
        emoji: nextEmoji,
      });
    } catch (err) {
      console.warn("[react] Meta reaction failed", err);
    }
  }

  revalidatePath("/inbox");

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.messageReact,
    entityType: "Message",
    entityId: messageId,
    metadata: {
      actorName: session.name,
      conversationId: message.conversationId,
      emoji: nextEmoji,
      cleared: nextEmoji === null,
    },
  });

  return { ok: true as const, emoji: nextEmoji };
}

export async function markConversationRead(conversationId: string) {
  const session = await requirePermission(PERMISSION_CODES.inboxRead);
  if (!conversationId) {
    throw new Error("Thiếu hội thoại");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
    select: { id: true, unread: true },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  if (conversation.unread === 0) {
    return { ok: true as const };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: 0 },
  });

  // Không revalidatePath: client đã optimistic unread=0; soft-refresh Inbox
  // sẽ cập nhật badge. Revalidate full /inbox sau mark-read dễ làm flight
  // RSC fail (React #441) hiện banner đỏ trên composer khi mở hội thoại.
  return { ok: true as const };
}

const CONVERSATION_TAGS: ConversationTag[] = ["new", "consulting", "closed", "spam"];

export async function updateConversationTag(
  conversationId: string,
  tag: ConversationTag,
) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
  if (!conversationId || !CONVERSATION_TAGS.includes(tag)) {
    throw new Error("Nhãn hội thoại không hợp lệ");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, shopId: session.shopId },
    select: { id: true, tag: true },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  if (conversation.tag === tag) {
    return { ok: true as const };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { tag },
  });

  revalidatePath("/inbox");

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.conversationTagChange,
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { from: conversation.tag, to: tag },
  });

  return { ok: true as const };
}

export async function createOrder(input: {
  conversationId: string;
  address: string;
  phone?: string;
  items: DraftOrderItem[];
}) {
  const session = await requirePermission(PERMISSION_CODES.ordersCreate);
  const address = input.address.trim();
  const phone = input.phone?.trim() || undefined;
  const items = normalizeOrderItems(input.items);

  if (!input.conversationId) {
    throw new Error("Thiếu hội thoại");
  }
  if (!address) {
    throw new Error("Nhập địa chỉ giao hàng");
  }
  if (items.length === 0) {
    throw new Error("Chọn ít nhất một sản phẩm");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, shopId: session.shopId },
    include: { customer: true },
  });
  if (!conversation) {
    throw new Error("Không tìm thấy hội thoại");
  }

  const products = await prisma.product.findMany({
    where: {
      shopId: session.shopId,
      id: { in: items.map((item) => item.productId) },
    },
  });
  if (products.length !== items.length) {
    throw new Error("Sản phẩm không hợp lệ");
  }

  const productById = new Map(products.map((item) => [item.id, item]));
  const existing = await prisma.order.findMany({
    where: { shopId: session.shopId },
    select: { code: true },
  });
  const code = nextOrderCode(existing.map((item) => item.code));

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        id: `o-${crypto.randomUUID()}`,
        shopId: session.shopId,
        customerId: conversation.customerId,
        conversationId: conversation.id,
        code,
        address,
        status: "new",
        items: {
          create: items.map((item) => {
            const product = productById.get(item.productId);
            if (!product) {
              throw new Error("Sản phẩm không hợp lệ");
            }
            return {
              productId: product.id,
              name: product.name,
              qty: item.qty,
              price: product.price,
            };
          }),
        },
      },
      include: { items: true },
    });

    await tx.customer.update({
      where: { id: conversation.customerId },
      data: {
        address,
        ...(phone ? { phone } : {}),
      },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { tag: "closed" },
    });

    return created;
  });

  revalidatePath("/inbox");
  revalidatePath("/orders");
  revalidatePath("/customers");

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.orderCreate,
    entityType: "Order",
    entityId: order.id,
    metadata: { code: order.code, conversationId: conversation.id },
  });

  return {
    id: order.id,
    code: order.code,
  };
}

const ORDER_STATUSES: OrderStatus[] = ["new", "confirmed", "shipping", "done", "cancelled"];

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await requirePermission(PERMISSION_CODES.ordersUpdate);
  if (!ORDER_STATUSES.includes(status)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId: session.shopId },
  });
  if (!order) {
    throw new Error("Không tìm thấy đơn");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.orderStatusChange,
    entityType: "Order",
    entityId: orderId,
    metadata: { from: order.status, to: status, code: order.code },
  });

  revalidatePath("/orders");
  revalidatePath("/inbox");
}
