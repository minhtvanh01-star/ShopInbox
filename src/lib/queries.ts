/** Server queries (`get*`): đọc PostgreSQL cho trang app. Tạm ở `lib` đến khi Lát 3/kênh ổn định. */
import { prisma } from "@/backend/prisma";
import { requireSession } from "@/backend/auth";
import { getPermissionCodes, hasPermission } from "@/backend/rbac";
import { resolveReplyClaim } from "@/backend/reply-claim";
import { getShopPolicy } from "@/backend/shop-policy";
import { roleLabel } from "@/lib/labels";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";
import { replyClaimTtlMs } from "@/lib/shop-policy";
import type { InboxNoticeSummary } from "@/lib/inbox-notices";
import type {
  Conversation,
  Customer,
  Message,
  Order,
  Product,
  QuickReply,
} from "@/lib/types";

export const DEMO_SHOP_ID = "shop1";

export type ShopContext = {
  shopId: string;
  shopName: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  role: string;
  roleLabel: string;
  permissions: string[];
  replyClaimTtlMinutes: number;
  maxUsersPerShop: number;
};

function toIso(value: Date) {
  return value.toISOString();
}

export async function getShopContext(): Promise<ShopContext> {
  const session = await requireSession();
  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: session.staffId },
    include: { shop: true, role: true },
  });

  return {
    shopId: staff.shopId,
    shopName: staff.shop.name,
    staffId: staff.id,
    staffName: staff.name,
    staffEmail: staff.email,
    role: staff.roleCode,
    roleLabel: staff.role?.name ?? roleLabel(staff.roleCode),
    permissions: await getPermissionCodes(session),
    replyClaimTtlMinutes: staff.shop.replyClaimTtlMinutes,
    maxUsersPerShop: staff.shop.maxUsersPerShop,
  };
}

export async function getInboxData() {
  const session = await requireSession();
  const shopId = session.shopId;
  const [conversations, messages, customers, orders, products, quickReplies, reactions, policy] =
    await Promise.all([
    prisma.conversation.findMany({
      where: { shopId },
      include: { staff: { select: { id: true, name: true } } },
      orderBy: { lastAt: "desc" },
    }),
    prisma.message.findMany({
      where: { shopId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customer.findMany({
      where: { shopId },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { shopId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { shopId, inStock: true },
      orderBy: { name: "asc" },
    }),
    prisma.quickReply.findMany({
      where: { shopId },
      orderBy: { title: "asc" },
    }),
    prisma.messageReaction.findMany({
      where: { shopId },
      select: { messageId: true, emoji: true, reactorKey: true },
    }),
    getShopPolicy(shopId),
  ]);

  const claimTtlMs = replyClaimTtlMs(policy.replyClaimTtlMinutes);

  const reactionsByMessage = new Map<
    string,
    { emoji: string; count: number; reactedByMe: boolean }[]
  >();
  const mineKey = `staff:${session.staffId}`;
  for (const row of reactions) {
    const list = reactionsByMessage.get(row.messageId) ?? [];
    const existing = list.find((item) => item.emoji === row.emoji);
    if (existing) {
      existing.count += 1;
      if (row.reactorKey === mineKey) existing.reactedByMe = true;
    } else {
      list.push({
        emoji: row.emoji,
        count: 1,
        reactedByMe: row.reactorKey === mineKey,
      });
    }
    reactionsByMessage.set(row.messageId, list);
  }

  return {
    currentStaffId: session.staffId,
    replyClaimTtlMinutes: policy.replyClaimTtlMinutes,
    conversations: conversations.map((item): Conversation => {
      const claim = resolveReplyClaim({
        staffId: item.staffId,
        staffName: item.staff?.name,
        replyClaimedAt: item.replyClaimedAt,
        currentStaffId: session.staffId,
        ttlMs: claimTtlMs,
      });
      return {
        id: item.id,
        channel: item.channel,
        customerId: item.customerId,
        lastMessage: item.lastMessage,
        lastAt: toIso(item.lastAt),
        unread: item.unread,
        tag: item.tag,
        replyStaffId: claim.staffId,
        replyStaffName: claim.staffName,
        replyClaimedAt: claim.claimedAt,
      };
    }),
    messages: messages.map(
      (item): Message => ({
        id: item.id,
        conversationId: item.conversationId,
        sender: item.sender,
        text: item.text,
        createdAt: toIso(item.createdAt),
        attachmentType: item.attachmentType,
        attachmentUrl: item.attachmentUrl,
        attachmentName: item.attachmentName,
        externalMessageId: item.externalMessageId,
        reactions: reactionsByMessage.get(item.id) ?? [],
      }),
    ),
    customers: customers.map(
      (item): Customer => ({
        id: item.id,
        name: item.name,
        phone: item.phone ?? undefined,
        email: item.email ?? undefined,
        address: item.address ?? undefined,
        note: item.note ?? undefined,
      }),
    ),
    orders: orders.map(
      (item): Order => ({
        id: item.id,
        code: item.code,
        customerId: item.customerId,
        conversationId: item.conversationId,
        address: item.address,
        status: item.status,
        createdAt: toIso(item.createdAt),
        items: item.items.map((orderItem) => ({
          productId: orderItem.productId ?? undefined,
          name: orderItem.name,
          qty: orderItem.qty,
          price: orderItem.price,
        })),
      }),
    ),
    products: products.map(
      (item): Product => ({
        id: item.id,
        name: item.name,
        sku: item.sku ?? undefined,
        price: item.price,
        inStock: item.inStock,
      }),
    ),
    quickReplies: quickReplies.map(
      (item): QuickReply => ({
        id: item.id,
        title: item.title,
        text: item.text,
      }),
    ),
  };
}

export async function getInboxNotificationSummary(): Promise<InboxNoticeSummary> {
  const session = await requireSession();
  const shopId = session.shopId;

  const [unreadRows, noticeRows, policy] = await Promise.all([
    prisma.conversation.findMany({
      where: { shopId, unread: { gt: 0 } },
      select: { unread: true },
    }),
    prisma.conversation.findMany({
      where: { shopId, unread: { gt: 0 } },
      include: {
        customer: { select: { name: true } },
        staff: { select: { name: true } },
      },
      orderBy: { lastAt: "desc" },
      take: 12,
    }),
    getShopPolicy(shopId),
  ]);

  const unreadTotal = unreadRows.reduce((sum, row) => sum + row.unread, 0);
  const claimTtlMs = replyClaimTtlMs(policy.replyClaimTtlMinutes);

  return {
    unreadTotal,
    unreadConversations: unreadRows.length,
    notices: noticeRows.map((item) => {
      const claim = resolveReplyClaim({
        staffId: item.staffId,
        staffName: item.staff?.name,
        replyClaimedAt: item.replyClaimedAt,
        currentStaffId: session.staffId,
        ttlMs: claimTtlMs,
      });
      return {
        conversationId: item.id,
        customerName: item.customer.name,
        preview: item.lastMessage,
        unread: item.unread,
        channel: item.channel,
        lastAt: toIso(item.lastAt),
        replyStaffName: claim.staffName,
        replyActive: claim.active,
      };
    }),
  };
}

export async function getOrdersPageData() {
  const session = await requireSession();
  const orders = await prisma.order.findMany({
    where: { shopId: session.shopId },
    include: {
      customer: true,
      conversation: true,
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => ({
    id: order.id,
    code: order.code,
    customerName: order.customer.name,
    channel: order.conversation.channel,
    status: order.status,
    createdAt: toIso(order.createdAt),
    items: order.items.map((item) => ({
      qty: item.qty,
      price: item.price,
    })),
  }));
}

export async function getCustomersPageData() {
  const session = await requireSession();
  const customers = await prisma.customer.findMany({
    where: { shopId: session.shopId },
    include: {
      _count: { select: { orders: true } },
    },
    orderBy: { name: "asc" },
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
    orderCount: customer._count.orders,
  }));
}

export async function getChannelAccounts() {
  const session = await requireSession();
  const canConnect = await hasPermission(session, PERMISSION_CODES.channelsConnect);

  const accounts = await prisma.channelAccount.findMany({
    where: { shopId: session.shopId },
    orderBy: { name: "asc" },
  });

  return accounts.map((account) => ({
    id: account.id,
    channel: account.channel,
    name: account.name,
    status: account.status,
    note: account.note,
    appId: canConnect ? account.appId : null,
    appSecret: canConnect ? account.appSecret : null,
    pageId: canConnect ? account.pageId : null,
    webhookSecret: canConnect ? account.webhookSecret : null,
    oaId: canConnect ? account.oaId : null,
    displayName: account.displayName,
    expiresAt: account.expiresAt ? toIso(account.expiresAt) : null,
    connectedAt: account.connectedAt ? toIso(account.connectedAt) : null,
    lastWebhookAt: account.lastWebhookAt ? toIso(account.lastWebhookAt) : null,
    hasOAuthToken: Boolean(account.accessToken),
  }));
}
