/** Server queries (`get*`): đọc PostgreSQL cho trang app. Tạm ở `lib` đến khi Lát 3/kênh ổn định. */
import { prisma } from "@/backend/prisma";
import { requireSession } from "@/backend/auth";
import { isMissingDbColumnError } from "@/backend/prisma-errors";
import { getPermissionCodes, hasPermission, requirePermission } from "@/backend/rbac";
import { resolveReplyClaim } from "@/backend/reply-claim";
import { getShopPolicy } from "@/backend/shop-policy";
import { roleLabel, parseVnDayEnd, parseVnDayStart } from "@/lib/labels";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";
import { replyClaimTtlMs } from "@/lib/shop-policy";
import type { InboxNoticeSummary } from "@/lib/inbox-notices";
import { visibleInboxChannels } from "@/lib/inbox-visibility";
import type {
  Channel,
  Conversation,
  Customer,
  Message,
  Order,
  SellableVariant,
  QuickReply,
} from "@/lib/types";
import { listSellableVariants } from "@/backend/product-catalog";

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
  isSuperAdmin: boolean;
};

function toIso(value: Date) {
  return value.toISOString();
}

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  avatarUrl?: string | null;
};

async function loadShopCustomers(shopId: string): Promise<CustomerRow[]> {
  try {
    return await prisma.customer.findMany({
      where: { shopId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        note: true,
        avatarUrl: true,
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    if (!isMissingDbColumnError(error, "avatarUrl")) {
      throw error;
    }
    console.error("[loadShopCustomers] avatarUrl missing — loading without avatars", error);
    return prisma.customer.findMany({
      where: { shopId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        note: true,
      },
      orderBy: { name: "asc" },
    });
  }
}

type MessageRow = {
  id: string;
  conversationId: string;
  sender: Message["sender"];
  text: string;
  createdAt: Date;
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  externalMessageId: string | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
};

async function loadVisibleInboxChannels(shopId: string): Promise<Channel[]> {
  const accounts = await prisma.channelAccount.findMany({
    where: { shopId },
    select: { channel: true, status: true },
  });
  return visibleInboxChannels(accounts);
}

async function loadShopMessages(shopId: string, channels: Channel[]): Promise<MessageRow[]> {
  if (channels.length === 0) {
    return [];
  }

  const where = { shopId, conversation: { channel: { in: channels } } };

  try {
    return await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    if (
      !isMissingDbColumnError(error, "deliveredAt") &&
      !isMissingDbColumnError(error, "readAt")
    ) {
      throw error;
    }
    console.error(
      "[loadShopMessages] deliveredAt/readAt missing — loading without receipts",
      error,
    );
    return prisma.message.findMany({
      where,
      select: {
        id: true,
        conversationId: true,
        sender: true,
        text: true,
        createdAt: true,
        attachmentType: true,
        attachmentUrl: true,
        attachmentName: true,
        externalMessageId: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

export async function getShopContext(): Promise<ShopContext> {
  const session = await requireSession();
  const [staff, policy] = await Promise.all([
    prisma.staff.findUniqueOrThrow({
      where: { id: session.staffId },
      include: {
        shop: { select: { id: true, name: true } },
        role: true,
      },
    }),
    getShopPolicy(session.shopId),
  ]);

  return {
    shopId: staff.shopId,
    shopName: staff.shop.name,
    staffId: staff.id,
    staffName: staff.name,
    staffEmail: staff.email,
    role: staff.roleCode,
    roleLabel: session.isSuperAdmin ? "Super admin" : staff.role?.name ?? roleLabel(staff.roleCode),
    permissions: await getPermissionCodes(session),
    replyClaimTtlMinutes: policy.replyClaimTtlMinutes,
    maxUsersPerShop: policy.maxUsersPerShop,
    isSuperAdmin: Boolean(session.isSuperAdmin),
  };
}

export async function getInboxData() {
  const session = await requirePermission(PERMISSION_CODES.inboxRead);
  const shopId = session.shopId;
  const readyChannels = await loadVisibleInboxChannels(shopId);
  const hideInbox = readyChannels.length === 0;
  const [conversations, messages, customers, orders, sellableVariants, quickReplies, reactions, policy] =
    await Promise.all([
    hideInbox
      ? Promise.resolve([])
      : prisma.conversation.findMany({
          where: { shopId, channel: { in: readyChannels } },
          include: { staff: { select: { id: true, name: true } } },
          orderBy: { lastAt: "desc" },
        }),
    loadShopMessages(shopId, readyChannels),
    loadShopCustomers(shopId),
    prisma.order.findMany({
      where: { shopId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    listSellableVariants(shopId),
    prisma.quickReply.findMany({
      where: { shopId },
      orderBy: { title: "asc" },
    }),
    hideInbox
      ? Promise.resolve([])
      : prisma.messageReaction.findMany({
          where: {
            shopId,
            message: { conversation: { channel: { in: readyChannels } } },
          },
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
        deliveredAt: item.deliveredAt ? toIso(item.deliveredAt) : null,
        readAt: item.readAt ? toIso(item.readAt) : null,
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
        avatarUrl: item.avatarUrl ?? undefined,
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
    products: sellableVariants as SellableVariant[],
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
  const session = await requirePermission(PERMISSION_CODES.inboxRead);
  const shopId = session.shopId;
  const readyChannels = await loadVisibleInboxChannels(shopId);

  if (readyChannels.length === 0) {
    return { unreadTotal: 0, unreadConversations: 0, notices: [] };
  }

  const unreadWhere = { shopId, unread: { gt: 0 }, channel: { in: readyChannels } };

  const [unreadRows, noticeRows, policy] = await Promise.all([
    prisma.conversation.findMany({
      where: unreadWhere,
      select: { unread: true },
    }),
    prisma.conversation.findMany({
      where: unreadWhere,
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

export async function getOrdersPageData(filters?: {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission(PERMISSION_CODES.ordersRead);
  const q = filters?.q?.trim() ?? "";
  const statusRaw = filters?.status?.trim() ?? "";
  const allowedStatuses = ["new", "confirmed", "shipping", "done", "cancelled"] as const;
  const status = allowedStatuses.find((item) => item === statusRaw);
  const from = parseVnDayStart(filters?.from);
  const to = parseVnDayEnd(filters?.to);
  const pageSize = filters?.pageSize ?? 25;

  const where: {
    shopId: string;
    status?: (typeof allowedStatuses)[number];
    createdAt?: { gte?: Date; lte?: Date };
    OR?: Array<
      | { code: { contains: string; mode: "insensitive" } }
      | { customer: { name: { contains: string; mode: "insensitive" } } }
    >;
  } = {
    shopId: session.shopId,
  };
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const page = Math.min(Math.max(1, filters?.page ?? 1), pageCount);

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: true,
      conversation: true,
      items: true,
      checklistChecks: {
        include: { template: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const rows = orders.map((order) => {
    const checklist = [...order.checklistChecks]
      .sort((a, b) => {
        const aOrder = a.template?.sortOrder ?? 0;
        const bOrder = b.template?.sortOrder ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.template?.label ?? "").localeCompare(b.template?.label ?? "");
      })
      .map((check) => ({
        id: check.id,
        label: check.template?.label ?? "Mục checklist",
        done: check.done,
        doneAt: check.doneAt ? toIso(check.doneAt) : null,
      }));

    return {
      id: order.id,
      code: order.code,
      customerId: order.customerId,
      customerName: order.customer.name,
      channel: order.conversation.channel,
      status: order.status,
      createdAt: toIso(order.createdAt),
      items: order.items.map((item) => ({
        qty: item.qty,
        price: item.price,
      })),
      checklist,
    };
  });

  return { total, page, orders: rows };
}

export async function getCustomersPageData() {
  const session = await requirePermission(PERMISSION_CODES.customersRead);
  const customers = await loadShopCustomers(session.shopId);
  const readyChannels = await loadVisibleInboxChannels(session.shopId);
  const [counts, latestConversations] = await Promise.all([
    prisma.customer.findMany({
      where: { shopId: session.shopId },
      select: {
        id: true,
        _count: { select: { orders: true } },
      },
    }),
    readyChannels.length === 0
      ? Promise.resolve([])
      : prisma.conversation.findMany({
          where: { shopId: session.shopId, channel: { in: readyChannels } },
          select: { id: true, customerId: true },
          orderBy: { lastAt: "desc" },
        }),
  ]);
  const orderCountById = new Map(counts.map((row) => [row.id, row._count.orders]));
  const latestConversationByCustomer = new Map<string, string>();
  for (const row of latestConversations) {
    if (!latestConversationByCustomer.has(row.customerId)) {
      latestConversationByCustomer.set(row.customerId, row.id);
    }
  }

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
    orderCount: orderCountById.get(customer.id) ?? 0,
    latestConversationId: latestConversationByCustomer.get(customer.id) ?? null,
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
    /** Không serialize secret xuống client — chỉ cờ đã có / chưa. */
    hasAppSecret: canConnect ? Boolean(account.appSecret?.trim()) : false,
    pageId: canConnect ? account.pageId : null,
    hasWebhookSecret: canConnect ? Boolean(account.webhookSecret?.trim()) : false,
    oaId: canConnect ? account.oaId : null,
    displayName: account.displayName,
    expiresAt: account.expiresAt ? toIso(account.expiresAt) : null,
    connectedAt: account.connectedAt ? toIso(account.connectedAt) : null,
    lastWebhookAt: account.lastWebhookAt ? toIso(account.lastWebhookAt) : null,
    hasOAuthToken: Boolean(account.accessToken),
  }));
}
