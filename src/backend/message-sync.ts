import {
  fetchMetaSenderProfile,
  inboundMessagesFromMetaConversations,
  type MetaConversation,
} from "@/backend/meta-oauth";
import { prisma } from "@/backend/prisma";
import { isMissingDbColumnError } from "@/backend/prisma-errors";
import { normalizeCustomerAvatarUrl } from "@/lib/customer-avatar";
import type { Channel } from "@/lib/types";

const CUSTOMER_CORE_SELECT = {
  id: true,
  shopId: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type InboundMessageInput = {
  channel: Channel;
  externalAccountId: string;
  senderExternalId: string;
  senderName?: string;
  senderAvatarUrl?: string | null;
  text: string;
  externalMessageId?: string;
  sentAt?: Date;
  touchWebhook?: boolean;
  attachmentType?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

function shortId(value: string) {
  return value.length > 8 ? value.slice(-8) : value;
}

function defaultSenderName(channel: Channel, senderExternalId: string) {
  const suffix = shortId(senderExternalId);
  if (channel === "facebook") return `Khách Facebook ${suffix}`;
  if (channel === "instagram") return `Khách Instagram ${suffix}`;
  if (channel === "zalo") return `Khách Zalo ${suffix}`;
  return `Khách ${suffix}`;
}

export async function findChannelAccount(channel: Channel, externalAccountId: string) {
  if (channel === "zalo") {
    return prisma.channelAccount.findFirst({
      where: { channel: "zalo", oaId: externalAccountId, status: "ready" },
    });
  }

  return prisma.channelAccount.findFirst({
    where: {
      channel,
      status: "ready",
      OR: [{ pageId: externalAccountId }, { linkedPageId: externalAccountId }],
    },
  });
}

async function findCustomerIdentity(shopId: string, channel: Channel, senderExternalId: string) {
  try {
    return await prisma.customerIdentity.findFirst({
      where: { channel, externalId: senderExternalId, customer: { shopId } },
      include: { customer: true },
    });
  } catch (error) {
    if (!isMissingDbColumnError(error, "avatarUrl")) {
      throw error;
    }
    return prisma.customerIdentity.findFirst({
      where: { channel, externalId: senderExternalId, customer: { shopId } },
      include: { customer: { select: CUSTOMER_CORE_SELECT } },
    });
  }
}

async function updateCustomerSafe(
  customerId: string,
  patch: { name?: string; avatarUrl?: string },
) {
  try {
    return await prisma.customer.update({
      where: { id: customerId },
      data: patch,
    });
  } catch (error) {
    if (!patch.avatarUrl || !isMissingDbColumnError(error, "avatarUrl")) {
      throw error;
    }
    const rest: { name?: string } = {};
    if (patch.name) {
      rest.name = patch.name;
    }
    if (Object.keys(rest).length === 0) {
      return prisma.customer.findUniqueOrThrow({
        where: { id: customerId },
        select: CUSTOMER_CORE_SELECT,
      });
    }
    return prisma.customer.update({
      where: { id: customerId },
      data: rest,
    });
  }
}

export async function findOrCreateCustomer(
  shopId: string,
  channel: Channel,
  senderExternalId: string,
  senderName?: string,
  senderAvatarUrl?: string | null,
) {
  const avatarUrl = normalizeCustomerAvatarUrl(senderAvatarUrl);
  const identity = await findCustomerIdentity(shopId, channel, senderExternalId);

  if (identity) {
    const name = senderName?.trim();
    const patch: { name?: string; avatarUrl?: string } = {};
    if (name && name !== identity.customer.name && identity.customer.name.startsWith("Khách")) {
      patch.name = name;
    }
    const currentAvatar =
      "avatarUrl" in identity.customer
        ? (identity.customer as { avatarUrl?: string | null }).avatarUrl
        : null;
    if (avatarUrl && avatarUrl !== currentAvatar) {
      patch.avatarUrl = avatarUrl;
    }
    if (Object.keys(patch).length > 0) {
      return updateCustomerSafe(identity.customerId, patch);
    }
    return identity.customer;
  }

  const customerId = `cust-${crypto.randomUUID()}`;
  const name = senderName?.trim() || defaultSenderName(channel, senderExternalId);
  const identityCreate = {
    create: {
      id: `cid-${crypto.randomUUID()}`,
      channel,
      externalId: senderExternalId,
    },
  };

  try {
    return await prisma.customer.create({
      data: {
        id: customerId,
        shopId,
        name,
        avatarUrl,
        identities: identityCreate,
      },
    });
  } catch (error) {
    if (!isMissingDbColumnError(error, "avatarUrl")) {
      throw error;
    }
    return prisma.customer.create({
      data: {
        id: customerId,
        shopId,
        name,
        identities: identityCreate,
      },
    });
  }
}

export async function findOrCreateConversation(
  shopId: string,
  customerId: string,
  channel: Channel,
) {
  const existing = await prisma.conversation.findFirst({
    where: { shopId, customerId, channel },
    orderBy: { lastAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.conversation.create({
    data: {
      id: `conv-${crypto.randomUUID()}`,
      shopId,
      customerId,
      channel,
      lastMessage: "",
      lastAt: new Date(),
      unread: 0,
      tag: "new",
    },
  });
}

async function enrichCustomerAvatarFromMeta(input: {
  customerId: string;
  senderExternalId: string;
  pageAccessToken: string;
  currentName: string;
}) {
  const profile = await fetchMetaSenderProfile(input.senderExternalId, input.pageAccessToken);
  if (!profile?.avatarUrl && !profile?.name) {
    return false;
  }

  const patch: { avatarUrl?: string; name?: string } = {};
  if (profile.avatarUrl) {
    patch.avatarUrl = profile.avatarUrl;
  }
  if (
    profile.name &&
    input.currentName.startsWith("Khách") &&
    profile.name !== input.currentName
  ) {
    patch.name = profile.name;
  }
  if (Object.keys(patch).length === 0) {
    return false;
  }

  await updateCustomerSafe(input.customerId, patch);
  return true;
}

export async function ingestInboundMessage(input: InboundMessageInput) {
  const account = await findChannelAccount(input.channel, input.externalAccountId);
  if (!account) {
    return { ok: false as const, reason: "channel_not_found" as const };
  }

  if (input.externalMessageId) {
    const duplicate = await prisma.message.findFirst({
      where: {
        shopId: account.shopId,
        externalMessageId: input.externalMessageId,
      },
    });
    if (duplicate) {
      return { ok: true as const, duplicate: true as const };
    }
  }

  const customer = await findOrCreateCustomer(
    account.shopId,
    input.channel,
    input.senderExternalId,
    input.senderName,
    input.senderAvatarUrl,
  );

  const customerAvatar =
    "avatarUrl" in customer
      ? (customer as { avatarUrl?: string | null }).avatarUrl
      : null;

  if (
    !customerAvatar &&
    (input.channel === "facebook" || input.channel === "instagram") &&
    account.accessToken
  ) {
    try {
      await enrichCustomerAvatarFromMeta({
        customerId: customer.id,
        senderExternalId: input.senderExternalId,
        pageAccessToken: account.accessToken,
        currentName: customer.name,
      });
    } catch (error) {
      console.error("[ingestInboundMessage] enrich avatar failed", error);
    }
  }

  const conversation = await findOrCreateConversation(
    account.shopId,
    customer.id,
    input.channel,
  );

  const sentAt = input.sentAt ?? new Date();
  const text = input.text.trim() || (input.attachmentUrl ? "[Ảnh]" : "");
  if (!text) {
    return { ok: false as const, reason: "empty_text" as const };
  }

  await prisma.$transaction([
    prisma.message.create({
      data: {
        shopId: account.shopId,
        conversationId: conversation.id,
        sender: "customer",
        text,
        attachmentType: input.attachmentType ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentName: input.attachmentName ?? null,
        externalMessageId: input.externalMessageId ?? null,
        createdAt: sentAt,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: text,
        lastAt: sentAt,
        unread: { increment: 1 },
        tag: conversation.tag === "closed" ? "new" : conversation.tag,
      },
    }),
    ...(input.touchWebhook === false
      ? []
      : [
          prisma.channelAccount.update({
            where: { id: account.id },
            data: { lastWebhookAt: new Date() },
          }),
        ]),
  ]);

  return {
    ok: true as const,
    duplicate: false as const,
    conversationId: conversation.id,
    shopId: account.shopId,
  };
}

export async function ingestRecentMetaMessages(input: {
  channel: Channel;
  externalAccountId: string;
  pageIdsToSkip: Array<string | null | undefined>;
  conversations: MetaConversation[];
}) {
  const inbound = inboundMessagesFromMetaConversations(input.conversations, input.pageIdsToSkip);
  let ingested = 0;

  for (const message of inbound) {
    const result = await ingestInboundMessage({
      channel: input.channel,
      externalAccountId: input.externalAccountId,
      senderExternalId: message.senderExternalId,
      senderName: message.senderName,
      senderAvatarUrl: message.senderAvatarUrl,
      text: message.text,
      externalMessageId: message.externalMessageId,
      sentAt: message.sentAt,
      touchWebhook: false,
    });
    if (result.ok && !result.duplicate) {
      ingested += 1;
    }
  }

  return ingested;
}

export async function touchChannelWebhook(channel: Channel, externalAccountId: string) {
  if (channel === "zalo") {
    const result = await prisma.channelAccount.updateMany({
      where: { channel: "zalo", oaId: externalAccountId },
      data: { lastWebhookAt: new Date() },
    });
    return result.count;
  }

  const result = await prisma.channelAccount.updateMany({
    where: {
      channel,
      OR: [{ pageId: externalAccountId }, { linkedPageId: externalAccountId }],
    },
    data: { lastWebhookAt: new Date() },
  });
  return result.count;
}

/**
 * Meta `message_deliveries` / `message_reads`: đánh dấu tin shop outbound
 * có createdAt <= watermark (và/hoặc theo mid) là đã nhận / đã xem.
 */
export async function applyMetaMessageWatermark(input: {
  channel: Channel;
  externalAccountId: string;
  customerExternalId: string;
  watermarkMs: number;
  kind: "delivered" | "read";
  mids?: string[];
}) {
  if (!Number.isFinite(input.watermarkMs) || input.watermarkMs <= 0) {
    return { ok: false as const, reason: "invalid_watermark" as const, updated: 0 };
  }

  if (input.customerExternalId === input.externalAccountId) {
    return { ok: false as const, reason: "page_as_reader" as const, updated: 0 };
  }

  const account = await findChannelAccount(input.channel, input.externalAccountId);
  if (!account) {
    return { ok: false as const, reason: "channel_not_found" as const, updated: 0 };
  }

  const pageIds = [account.pageId, account.linkedPageId, account.oaId].filter(
    (id): id is string => Boolean(id),
  );
  if (pageIds.includes(input.customerExternalId)) {
    return { ok: false as const, reason: "page_as_reader" as const, updated: 0 };
  }

  const identity = await prisma.customerIdentity.findFirst({
    where: {
      channel: input.channel,
      externalId: input.customerExternalId,
      customer: { shopId: account.shopId },
    },
    select: { customerId: true },
  });
  if (!identity) {
    return { ok: false as const, reason: "customer_not_found" as const, updated: 0 };
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      shopId: account.shopId,
      customerId: identity.customerId,
      channel: input.channel,
    },
    orderBy: { lastAt: "desc" },
    select: { id: true },
  });
  if (!conversation) {
    return { ok: false as const, reason: "conversation_not_found" as const, updated: 0 };
  }

  const watermarkAt = new Date(input.watermarkMs);
  const mids = (input.mids ?? []).filter(Boolean);
  const baseWhere = {
    shopId: account.shopId,
    conversationId: conversation.id,
    sender: "shop" as const,
  };

  let updated = 0;

  try {
    if (input.kind === "delivered") {
      const byWatermark = await prisma.message.updateMany({
        where: {
          ...baseWhere,
          createdAt: { lte: watermarkAt },
          deliveredAt: null,
        },
        data: { deliveredAt: watermarkAt },
      });
      updated += byWatermark.count;

      if (mids.length > 0) {
        const byMid = await prisma.message.updateMany({
          where: {
            ...baseWhere,
            externalMessageId: { in: mids },
            deliveredAt: null,
          },
          data: { deliveredAt: watermarkAt },
        });
        updated += byMid.count;
      }
    } else {
      const deliverMissing = await prisma.message.updateMany({
        where: {
          ...baseWhere,
          createdAt: { lte: watermarkAt },
          deliveredAt: null,
        },
        data: { deliveredAt: watermarkAt },
      });
      updated += deliverMissing.count;

      const readByWatermark = await prisma.message.updateMany({
        where: {
          ...baseWhere,
          createdAt: { lte: watermarkAt },
          readAt: null,
        },
        data: { readAt: watermarkAt },
      });
      updated += readByWatermark.count;

      if (mids.length > 0) {
        const deliverByMid = await prisma.message.updateMany({
          where: {
            ...baseWhere,
            externalMessageId: { in: mids },
            deliveredAt: null,
          },
          data: { deliveredAt: watermarkAt },
        });
        updated += deliverByMid.count;

        const readByMid = await prisma.message.updateMany({
          where: {
            ...baseWhere,
            externalMessageId: { in: mids },
            readAt: null,
          },
          data: { readAt: watermarkAt },
        });
        updated += readByMid.count;
      }
    }
  } catch (error) {
    if (isMissingDbColumnError(error, "deliveredAt") || isMissingDbColumnError(error, "readAt")) {
      console.warn("[applyMetaMessageWatermark] missing deliveredAt/readAt column — run migrate");
      return { ok: false as const, reason: "schema_missing" as const, updated: 0 };
    }
    throw error;
  }

  return { ok: true as const, updated };
}

export async function upsertMessageReaction(input: {
  shopId: string;
  messageId: string;
  reactorKey: string;
  emoji: string;
  staffId?: string | null;
}) {
  return prisma.messageReaction.upsert({
    where: {
      messageId_reactorKey: {
        messageId: input.messageId,
        reactorKey: input.reactorKey,
      },
    },
    create: {
      shopId: input.shopId,
      messageId: input.messageId,
      reactorKey: input.reactorKey,
      emoji: input.emoji,
      staffId: input.staffId ?? null,
    },
    update: {
      emoji: input.emoji,
      staffId: input.staffId ?? null,
    },
  });
}

export async function removeMessageReaction(messageId: string, reactorKey: string) {
  await prisma.messageReaction.deleteMany({
    where: { messageId, reactorKey },
  });
}
