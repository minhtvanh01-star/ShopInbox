import {
  fetchMetaSenderProfile,
  inboundMessagesFromMetaConversations,
  type MetaConversation,
} from "@/backend/meta-oauth";
import { prisma } from "@/backend/prisma";
import { normalizeCustomerAvatarUrl } from "@/lib/customer-avatar";
import type { Channel } from "@/lib/types";

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

export async function findOrCreateCustomer(
  shopId: string,
  channel: Channel,
  senderExternalId: string,
  senderName?: string,
  senderAvatarUrl?: string | null,
) {
  const avatarUrl = normalizeCustomerAvatarUrl(senderAvatarUrl);
  const identity = await prisma.customerIdentity.findFirst({
    where: { channel, externalId: senderExternalId, customer: { shopId } },
    include: { customer: true },
  });

  if (identity) {
    const name = senderName?.trim();
    const patch: { name?: string; avatarUrl?: string } = {};
    if (name && name !== identity.customer.name && identity.customer.name.startsWith("Khách")) {
      patch.name = name;
    }
    if (avatarUrl && avatarUrl !== identity.customer.avatarUrl) {
      patch.avatarUrl = avatarUrl;
    }
    if (Object.keys(patch).length > 0) {
      const updated = await prisma.customer.update({
        where: { id: identity.customerId },
        data: patch,
      });
      return updated;
    }
    return identity.customer;
  }

  const customerId = `cust-${crypto.randomUUID()}`;
  const name = senderName?.trim() || defaultSenderName(channel, senderExternalId);

  return prisma.customer.create({
    data: {
      id: customerId,
      shopId,
      name,
      avatarUrl,
      identities: {
        create: {
          id: `cid-${crypto.randomUUID()}`,
          channel,
          externalId: senderExternalId,
        },
      },
    },
  });
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

  await prisma.customer.update({
    where: { id: input.customerId },
    data: patch,
  });
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

  if (
    !customer.avatarUrl &&
    (input.channel === "facebook" || input.channel === "instagram") &&
    account.accessToken
  ) {
    await enrichCustomerAvatarFromMeta({
      customerId: customer.id,
      senderExternalId: input.senderExternalId,
      pageAccessToken: account.accessToken,
      currentName: customer.name,
    });
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
