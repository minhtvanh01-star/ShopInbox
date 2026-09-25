"use server";

/** Server mutations (inbox/orders). Tạm cạnh route đến khi Lát 3 ổn định. */
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import {
  dispatchOutboundImage,
  dispatchOutboundMessage,
  dispatchOutboundReaction,
} from "@/backend/channel-send";
import {
  evaluateReplyClaimAccess,
  evaluateReplyClaimRelease,
  evaluateReplyClaimTouch,
  isReplyClaimActive,
} from "@/backend/reply-claim";
import { getShopPolicy } from "@/backend/shop-policy";
import {
  hasPermission,
  isAdminSession,
  requireActionPermission,
} from "@/backend/rbac";
import { nextOrderCode, normalizeOrderItems, type DraftOrderItem } from "@/backend/order-code";
import {
  removeMessageReaction,
  upsertMessageReaction,
} from "@/backend/message-sync";
import { attachChecklistToOrder } from "@/backend/order-checklist";
import { prisma } from "@/backend/prisma";
import { isMissingDbColumnError, isUniqueConstraintError } from "@/backend/prisma-errors";
import { saveShopImageUpload } from "@/backend/upload-store";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import { parseCustomerProfileInput, parseOrderDeliveryInput } from "@/lib/customer-profile";
import { parseOutboundMessageText, validateImageFileForUpload } from "@/lib/inbox-media";
import { replyClaimTtlMs } from "@/lib/shop-policy";
import type { ConversationTag, OrderStatus } from "@/lib/types";
import type { SessionPayload } from "@/backend/session-token";

/** Local only — must not be exported from a "use server" module. */
const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

function actionFailureMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }
  if (typeof err === "string" && err.trim()) {
    return err.trim();
  }
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return fallback;
}

/** Khớp Inbox UI: role admin/owner hoặc quyền staff.manage. */
async function isInboxAdmin(session: SessionPayload) {
  return isAdminSession(session) || (await hasPermission(session, PERMISSION_CODES.staffManage));
}

async function shopClaimTtlMs(shopId: string) {
  const policy = await getShopPolicy(shopId);
  return replyClaimTtlMs(policy.replyClaimTtlMinutes);
}

function assertCanReply(input: {
  staffId: string | null;
  replyClaimedAt: Date | null;
  currentStaffId: string;
  isAdmin?: boolean;
  ttlMs: number;
}) {
  if (input.isAdmin) {
    return;
  }
  if (!input.staffId || !isReplyClaimActive(input.replyClaimedAt, Date.now(), input.ttlMs)) {
    throw new Error('Hãy bấm "Tôi trả lời" trước khi gửi tin.');
  }
  if (input.staffId !== input.currentStaffId) {
    throw new Error("Hội thoại đang được nhân viên khác trả lời.");
  }
}

/**
 * Gửi tin: admin luôn được; nhân viên giữ claim còn hạn;
 * nếu trống/hết hạn thì claim ngay (chống race UI sau "Tôi trả lời").
 */
async function assertCanReplyOrClaim(input: {
  conversationId: string;
  staffId: string | null;
  replyClaimedAt: Date | null;
  currentStaffId: string;
  isAdmin?: boolean;
  ttlMs: number;
}) {
  if (input.isAdmin) {
    return;
  }
  if (
    input.staffId &&
    input.staffId !== input.currentStaffId &&
    isReplyClaimActive(input.replyClaimedAt, Date.now(), input.ttlMs)
  ) {
    throw new Error("Hội thoại đang được nhân viên khác trả lời.");
  }
  if (
    input.staffId === input.currentStaffId &&
    isReplyClaimActive(input.replyClaimedAt, Date.now(), input.ttlMs)
  ) {
    return;
  }
  const expiredBefore = new Date(Date.now() - input.ttlMs);
  const claimed = await prisma.conversation.updateMany({
    where: {
      id: input.conversationId,
      OR: [
        { staffId: null },
        { staffId: input.currentStaffId },
        { replyClaimedAt: null },
        { replyClaimedAt: { lt: expiredBefore } },
      ],
    },
    data: {
      staffId: input.currentStaffId,
      replyClaimedAt: new Date(),
    },
  });
  if (claimed.count === 0) {
    throw new Error("Hội thoại đang được nhân viên khác trả lời.");
  }
}

async function persistOutboundThread(input: {
  shopId: string;
  conversationId: string;
  staffId: string;
  text: string;
  createdAt: Date;
  externalMessageId: string | null;
  attachmentType?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  admin: boolean;
  conversationStaffId: string | null;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            shopId: input.shopId,
            conversationId: input.conversationId,
            staffId: input.staffId,
            sender: "shop",
            text: input.text,
            attachmentType: input.attachmentType ?? null,
            attachmentUrl: input.attachmentUrl ?? null,
            attachmentName: input.attachmentName ?? null,
            externalMessageId: input.externalMessageId,
            createdAt: input.createdAt,
          },
        });
        await tx.conversation.update({
          where: { id: input.conversationId },
          data: {
            lastMessage: input.text,
            lastAt: input.createdAt,
            unread: 0,
            ...(input.admin
              ? input.conversationStaffId === input.staffId
                ? { staffId: null, replyClaimedAt: null }
                : {}
              : {
                  replyClaimedAt: input.createdAt,
                  staffId: input.staffId,
                }),
          },
        });
        return message;
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Không lưu được tin đã gửi.");
}

export async function claimConversation(conversationId: string) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.inboxReply);
    const admin = await isInboxAdmin(session);
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

    const ttlMs = await shopClaimTtlMs(session.shopId);
    const access = evaluateReplyClaimAccess({
      isAdmin: admin,
      currentStaffId: session.staffId,
      holderStaffId: conversation.staffId,
      holderName: conversation.staff?.name,
      replyClaimedAt: conversation.replyClaimedAt,
      ttlMs,
    });
    if (!access.ok) {
      return { ok: false as const, error: access.error };
    }

    const claimedAt = new Date();
    const expiredBefore = new Date(claimedAt.getTime() - ttlMs);
    const claimed = await prisma.conversation.updateMany({
      where: admin
        ? { id: conversationId, shopId: session.shopId }
        : {
            id: conversationId,
            shopId: session.shopId,
            OR: [
              { staffId: null },
              { staffId: session.staffId },
              { replyClaimedAt: null },
              { replyClaimedAt: { lt: expiredBefore } },
            ],
          },
      data: {
        staffId: session.staffId,
        replyClaimedAt: claimedAt,
      },
    });
    if (claimed.count === 0) {
      return { ok: false as const, error: "Hội thoại vừa được người khác nhận." };
    }

    // Không revalidatePath("/inbox"): dễ React #441; client giữ claimOverrides đến soft-refresh.

    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.conversationClaim,
      entityType: "Conversation",
      entityId: conversationId,
      metadata: {
        actorName: session.name,
        channel: conversation.channel,
        customerName: conversation.customer.name,
        reason:
          admin && conversation.staffId && conversation.staffId !== session.staffId
            ? "admin_takeover"
            : "manual",
      },
    });

    return {
      ok: true as const,
      claimedAt: claimedAt.toISOString(),
      staffId: session.staffId,
      staffName: session.name,
    };
  } catch (err) {
    console.error("[claimConversation]", err);
    return {
      ok: false as const,
      error: actionFailureMessage(err, "Không nhận được hội thoại"),
    };
  }
}

export async function releaseConversation(
  conversationId: string,
  reason: "manual" | "idle_timeout" = "manual",
) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.inboxReply);
    const admin = await isInboxAdmin(session);
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

    const ttlMs = await shopClaimTtlMs(session.shopId);
    const access = evaluateReplyClaimRelease({
      isAdmin: admin,
      currentStaffId: session.staffId,
      holderStaffId: conversation.staffId,
      replyClaimedAt: conversation.replyClaimedAt,
      ttlMs,
    });
    if (!access.ok) {
      return { ok: false as const, error: access.error };
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        staffId: null,
        replyClaimedAt: null,
      },
    });

    // Không revalidatePath — giống claim/send (tránh React #441); client refresh.

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
  } catch (err) {
    console.error("[releaseConversation]", err);
    return {
      ok: false as const,
      error: actionFailureMessage(err, "Không nhả được hội thoại"),
    };
  }
}

/** Gia hạn claim khi đang gõ / còn dùng — tránh timeout vì idle. */
export async function touchConversationClaim(conversationId: string) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.inboxReply);
    const admin = await isInboxAdmin(session);
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

    const ttlMs = await shopClaimTtlMs(session.shopId);
    const access = evaluateReplyClaimTouch({
      isAdmin: admin,
      currentStaffId: session.staffId,
      holderStaffId: conversation.staffId,
      replyClaimedAt: conversation.replyClaimedAt,
      ttlMs,
    });
    if (!access.ok) {
      return { ok: false as const, error: access.error };
    }
    if (!access.renew) {
      return { ok: true as const, claimedAt: null, skipped: true as const };
    }

    const claimedAt = new Date();
    const touched = await prisma.conversation.updateMany({
      where: {
        id: conversationId,
        shopId: session.shopId,
        staffId: session.staffId,
      },
      data: {
        staffId: session.staffId,
        replyClaimedAt: claimedAt,
      },
    });
    if (touched.count === 0) {
      return { ok: false as const, error: "Hội thoại vừa được người khác nhận." };
    }

    // Không revalidatePath — tránh nhảy UI khi đang gõ; client tự cập nhật claimedAt.
    return { ok: true as const, claimedAt: claimedAt.toISOString() };
  } catch (err) {
    console.error("[touchConversationClaim]", err);
    return {
      ok: false as const,
      error: actionFailureMessage(err, "Không gia hạn được hội thoại"),
    };
  }
}

export async function sendMessage(conversationId: string, text: string) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.inboxReply);
    const admin = await isInboxAdmin(session);
    const parsed = parseOutboundMessageText(text);
    if (!conversationId) {
      throw new Error("Thiếu hội thoại");
    }
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    const body = parsed.value;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, shopId: session.shopId },
    });
    if (!conversation) {
      throw new Error("Không tìm thấy hội thoại");
    }

    const ttlMs = await shopClaimTtlMs(session.shopId);
    await assertCanReplyOrClaim({
      conversationId,
      staffId: conversation.staffId,
      replyClaimedAt: conversation.replyClaimedAt,
      currentStaffId: session.staffId,
      isAdmin: admin,
      ttlMs,
    });

    const outbound = await dispatchOutboundMessage({
      shopId: session.shopId,
      channel: conversation.channel,
      customerId: conversation.customerId,
      text: body,
    });

    const createdAt = new Date();
    let message;
    try {
      message = await persistOutboundThread({
        shopId: session.shopId,
        conversationId,
        staffId: session.staffId,
        text: body,
        createdAt,
        externalMessageId: outbound.mode === "remote" ? outbound.externalMessageId : null,
        admin,
        conversationStaffId: conversation.staffId,
      });
    } catch (error) {
      if (outbound.mode === "remote") {
        throw new Error(
          "Đã gửi trên kênh nhưng không lưu được inbox. Tải lại trang để kiểm tra.",
        );
      }
      throw error;
    }

    // Không revalidatePath("/inbox"): kết hợp với useOptimistic + soft-refresh
    // dễ làm flight RSC fail (React #441) — tin biến mất / báo gửi lỗi giả.
    // Client gọi router.refresh() trong cùng transition sau mutation.

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
      ok: true as const,
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      attachmentType: null as string | null,
      attachmentUrl: null as string | null,
      attachmentName: null as string | null,
      externalMessageId: message.externalMessageId,
      deliveredAt: null as string | null,
      readAt: null as string | null,
      reactions: [] as { emoji: string; count: number; reactedByMe: boolean }[],
    };
  } catch (err) {
    console.error("[sendMessage]", err);
    return {
      ok: false as const,
      error: actionFailureMessage(err, "Gửi tin thất bại"),
    };
  }
}

export async function sendImageMessage(conversationId: string, formData: FormData) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.inboxReply);
    const admin = await isInboxAdmin(session);
    if (!conversationId) {
      throw new Error("Thiếu hội thoại");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Chọn một ảnh để gửi.");
    }
    const fileCheck = validateImageFileForUpload(file);
    if (!fileCheck.ok) {
      throw new Error(fileCheck.error);
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, shopId: session.shopId },
    });
    if (!conversation) {
      throw new Error("Không tìm thấy hội thoại");
    }

    const ttlMs = await shopClaimTtlMs(session.shopId);
    await assertCanReplyOrClaim({
      conversationId,
      staffId: conversation.staffId,
      replyClaimedAt: conversation.replyClaimedAt,
      currentStaffId: session.staffId,
      isAdmin: admin,
      ttlMs,
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
    const captionRaw = String(formData.get("caption") ?? "").trim();
    const caption = captionRaw
      ? parseOutboundMessageText(captionRaw)
      : ({ ok: true as const, value: "" } as const);
    if (!caption.ok) {
      throw new Error(caption.error);
    }
    const text = caption.value || "[Ảnh]";

    let message;
    try {
      message = await persistOutboundThread({
        shopId: session.shopId,
        conversationId,
        staffId: session.staffId,
        text,
        createdAt,
        externalMessageId: outbound.mode === "remote" ? outbound.externalMessageId : null,
        attachmentType: "image",
        attachmentUrl: saved.publicPath,
        attachmentName: saved.fileName,
        admin,
        conversationStaffId: conversation.staffId,
      });
    } catch (error) {
      if (outbound.mode === "remote") {
        throw new Error(
          "Đã gửi ảnh trên kênh nhưng không lưu được inbox. Tải lại trang để kiểm tra.",
        );
      }
      throw error;
    }

    // Không revalidatePath — xem sendMessage (tránh React #441 / tin biến mất).

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
      ok: true as const,
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      attachmentType: message.attachmentType,
      attachmentUrl: message.attachmentUrl,
      attachmentName: message.attachmentName,
      externalMessageId: message.externalMessageId,
      deliveredAt: null as string | null,
      readAt: null as string | null,
      reactions: [] as { emoji: string; count: number; reactedByMe: boolean }[],
    };
  } catch (err) {
    console.error("[sendImageMessage]", err);
    return {
      ok: false as const,
      error: actionFailureMessage(err, "Gửi ảnh thất bại"),
    };
  }
}

export async function reactToMessage(messageId: string, emoji: string) {
  const session = await requireActionPermission(PERMISSION_CODES.inboxReply);
  const admin = await isInboxAdmin(session);
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

  const ttlMs = await shopClaimTtlMs(session.shopId);
  assertCanReply({
    staffId: message.conversation.staffId,
    replyClaimedAt: message.conversation.replyClaimedAt,
    currentStaffId: session.staffId,
    isAdmin: admin,
    ttlMs,
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
      if (existing?.emoji) {
        await upsertMessageReaction({
          shopId: session.shopId,
          messageId,
          reactorKey,
          emoji: existing.emoji,
          staffId: session.staffId,
        });
      } else {
        await removeMessageReaction(messageId, reactorKey);
      }
      throw err instanceof Error ? err : new Error("Không gửi được reaction.");
    }
  }

  // Không revalidatePath — client router.refresh(); tránh React #441 trên composer.

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
  try {
    const session = await requireActionPermission(PERMISSION_CODES.inboxRead);
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

    // Không revalidatePath("/inbox"): dễ React #441 trên composer.
    // Client giữ read-receipt local + notifyInboxNoticesRefresh cho Sidebar.
    return { ok: true as const };
  } catch (err) {
    console.error("[markConversationRead]", err);
    return {
      ok: false as const,
      error: actionFailureMessage(err, "Không đánh dấu đã đọc được"),
    };
  }
}

const RECEIPT_POLL_LIMIT = 80;

/** Poll nhẹ tick đã xem — không RSC refresh. Chỉ Meta `readAt`/`deliveredAt` tin shop. */
export async function getConversationReceipts(conversationId: string) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.inboxRead);
    if (!conversationId) {
      return { ok: false as const, error: "missing" as const };
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, shopId: session.shopId },
      select: { id: true },
    });
    if (!conversation) {
      return { ok: false as const, error: "not_found" as const };
    }

    const rows = await prisma.message.findMany({
      where: {
        shopId: session.shopId,
        conversationId,
        sender: "shop",
        OR: [{ readAt: { not: null } }, { deliveredAt: { not: null } }],
      },
      select: { id: true, deliveredAt: true, readAt: true },
      orderBy: { createdAt: "desc" },
      take: RECEIPT_POLL_LIMIT,
    });

    return {
      ok: true as const,
      conversationId,
      receipts: rows.map((row) => ({
        id: row.id,
        deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
        readAt: row.readAt ? row.readAt.toISOString() : null,
      })),
    };
  } catch (error) {
    if (isMissingDbColumnError(error, "deliveredAt") || isMissingDbColumnError(error, "readAt")) {
      return {
        ok: true as const,
        conversationId,
        receipts: [] as Array<{
          id: string;
          deliveredAt: string | null;
          readAt: string | null;
        }>,
      };
    }
    console.error("[getConversationReceipts]", error);
    return { ok: false as const, error: "failed" as const };
  }
}

const CONVERSATION_TAGS: ConversationTag[] = ["new", "consulting", "closed", "spam"];

export async function updateConversationTag(
  conversationId: string,
  tag: ConversationTag,
) {
  const session = await requireActionPermission(PERMISSION_CODES.inboxReply);
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

  // Không revalidatePath — optimistic + soft-refresh; tránh React #441 khi đang soạn tin.

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.conversationTagChange,
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { from: conversation.tag, to: tag },
  });

  return { ok: true as const };
}

export async function updateCustomerProfile(input: {
  customerId: string;
  phone?: string;
  address?: string;
  note?: string;
}) {
  const session = await requireActionPermission(PERMISSION_CODES.inboxReply);

  const customerId = input.customerId.trim();
  if (!customerId) {
    return { ok: false as const, error: "Thiếu khách hàng." };
  }

  const parsed = parseCustomerProfileInput(input);
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error };
  }

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, shopId: session.shopId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false as const, error: "Không tìm thấy khách hàng." };
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: parsed.profile,
    select: { phone: true, address: true, note: true },
  });

  await writeAudit({
    actor: session,
    action: AUDIT_ACTIONS.customerUpdate,
    entityType: "Customer",
    entityId: customerId,
    metadata: { fields: ["phone", "address", "note"] },
  });

  revalidatePath("/inbox");
  revalidatePath("/customers");

  return {
    ok: true as const,
    customer: {
      phone: updated.phone ?? undefined,
      address: updated.address ?? undefined,
      note: updated.note ?? undefined,
    },
  };
}

export async function createOrder(input: {
  conversationId: string;
  address: string;
  phone?: string;
  items: DraftOrderItem[];
}) {
  const session = await requireActionPermission(PERMISSION_CODES.ordersCreate);
  const delivery = parseOrderDeliveryInput({
    address: input.address,
    phone: input.phone,
  });
  if (!delivery.ok) {
    throw new Error(delivery.error);
  }
  const { address, phone } = delivery;
  const items = normalizeOrderItems(Array.isArray(input.items) ? input.items : []);

  if (!input.conversationId) {
    throw new Error("Thiếu hội thoại");
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

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: items.map((item) => item.variantId) },
      selling: true,
      product: { shopId: session.shopId, selling: true },
    },
    include: { product: true },
  });
  if (variants.length !== items.length) {
    throw new Error("Biến thể sản phẩm không hợp lệ hoặc đã ngưng bán");
  }

  const variantById = new Map(variants.map((item) => [item.id, item]));

  let order: Awaited<ReturnType<typeof prisma.order.create>> | null = null;
  let lastCreateError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await prisma.order.findMany({
      where: { shopId: session.shopId },
      select: { code: true },
    });
    const code = nextOrderCode(existing.map((item) => item.code));
    try {
      order = await prisma.$transaction(async (tx) => {
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
                const variant = variantById.get(item.variantId);
                if (!variant) {
                  throw new Error("Biến thể sản phẩm không hợp lệ");
                }
                const lineName =
                  variant.name === variant.product.name
                    ? variant.product.name
                    : `${variant.product.name} — ${variant.name}`;
                return {
                  productId: variant.productId,
                  variantId: variant.id,
                  name: lineName,
                  qty: item.qty,
                  price: variant.price,
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

        await attachChecklistToOrder(session.shopId, created.id, tx);
        return created;
      });
      break;
    } catch (error) {
      lastCreateError = error;
      if (!isUniqueConstraintError(error) || attempt === 3) {
        throw error;
      }
    }
  }
  if (!order) {
    throw lastCreateError instanceof Error ? lastCreateError : new Error("Không tạo được đơn");
  }

  revalidatePath("/inbox");
  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/products");

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
  const session = await requireActionPermission(PERMISSION_CODES.ordersUpdate);
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

export async function toggleOrderChecklistAction(
  orderId: string,
  checkId: string,
  done: boolean,
) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.ordersUpdate);
    const { setOrderChecklistDone } = await import("@/backend/order-checklist");
    const result = await setOrderChecklistDone({
      shopId: session.shopId,
      orderId,
      checkId,
      done,
      staffId: session.staffId,
    });
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.orderChecklistToggle,
      entityType: "OrderChecklistCheck",
      entityId: checkId,
      metadata: {
        orderId,
        orderCode: result.orderCode,
        label: result.label,
        from: result.from,
        to: result.to,
        actorName: session.name,
      },
    });
    revalidatePath("/orders");
    revalidatePath("/inbox");
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Không cập nhật checklist.",
    };
  }
}

export async function attachOrderChecklistAction(orderId: string) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.ordersUpdate);
    if (!orderId) {
      return { ok: false as const, error: "Thiếu đơn hàng." };
    }
    const { ensureChecklistOnOrder } = await import("@/backend/order-checklist");
    const checks = await ensureChecklistOnOrder(session.shopId, orderId);
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.orderChecklistToggle,
      entityType: "Order",
      entityId: orderId,
      metadata: {
        op: "attach_checklist",
        count: checks.length,
        actorName: session.name,
      },
    });
    revalidatePath("/orders");
    revalidatePath("/inbox");
    return { ok: true as const, count: checks.length };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Không gắn được checklist.",
    };
  }
}

export async function mergeCustomerOpenOrdersAction(customerId: string) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.ordersUpdate);
    if (!customerId) {
      return { ok: false as const, error: "Thiếu khách hàng." };
    }
    const { mergeNewOrdersForCustomer } = await import("@/backend/order-merge");
    const result = await mergeNewOrdersForCustomer(session.shopId, customerId);
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.orderStatusChange,
      entityType: "Order",
      entityId: result.targetOrderId,
      metadata: {
        op: "merge_open_orders",
        targetCode: result.targetCode,
        cancelledCodes: result.cancelledCodes,
        actorName: session.name,
      },
    });
    revalidatePath("/orders");
    revalidatePath("/inbox");
    revalidatePath("/customers");
    return {
      ok: true as const,
      message: `Đã gộp vào ${result.targetCode}; hủy ${result.cancelledCodes.join(", ")}.`,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Không gộp được đơn.",
    };
  }
}

export async function mergeCustomersAction(keepId: string, absorbId: string) {
  try {
    const session = await requireActionPermission(PERMISSION_CODES.customersUpdate);
    const { mergeCustomers } = await import("@/backend/customer-merge");
    const result = await mergeCustomers(session.shopId, keepId, absorbId);
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.customerUpdate,
      entityType: "Customer",
      entityId: result.keepId,
      metadata: {
        op: "merge_customers",
        absorbId: result.absorbId,
        actorName: session.name,
      },
    });
    revalidatePath("/customers");
    revalidatePath("/inbox");
    revalidatePath("/orders");
    return {
      ok: true as const,
      message: `Đã gộp khách vào «${result.keepName}».`,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Không gộp được khách.",
    };
  }
}
