"use server";

/** Server mutations (inbox/orders). Tạm cạnh route đến khi Lát 3 ổn định. */
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import { dispatchOutboundMessage } from "@/backend/channel-send";
import { requirePermission } from "@/backend/rbac";
import { nextOrderCode, normalizeOrderItems, type DraftOrderItem } from "@/backend/order-code";
import { prisma } from "@/backend/prisma";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import type { OrderStatus } from "@/lib/types";

export async function sendMessage(conversationId: string, text: string) {
  const session = await requirePermission(PERMISSION_CODES.inboxReply);
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
    },
  });

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
  };
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
