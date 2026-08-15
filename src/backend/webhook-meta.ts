import {
  ingestInboundMessage,
  removeMessageReaction,
  touchChannelWebhook,
  upsertMessageReaction,
} from "@/backend/message-sync";
import { prisma } from "@/backend/prisma";
import type { Channel } from "@/lib/types";

type MetaAttachment = {
  type?: string;
  payload?: { url?: string; title?: string };
};

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: MetaAttachment[];
  };
  postback?: {
    mid?: string;
    title?: string;
    payload?: string;
  };
  reaction?: {
    mid?: string;
    action?: string;
    emoji?: string;
    reaction?: string;
  };
};

type MetaWebhookChange = {
  field?: string;
  value?: {
    sender?: { id?: string };
    recipient?: { id?: string };
    timestamp?: number;
    message?: {
      mid?: string;
      text?: string;
      is_echo?: boolean;
      attachments?: MetaAttachment[];
    };
    reaction?: string;
    emoji?: string;
    action?: string;
    mid?: string;
    message_id?: string;
  };
};

type MetaWebhookEntry = {
  id?: string;
  time?: number;
  messaging?: MetaMessagingEvent[];
  changes?: MetaWebhookChange[];
};

type MetaWebhookBody = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

const META_REACTION_TO_EMOJI: Record<string, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  haha: "😂",
  wow: "😮",
  sorry: "😢",
  sad: "😢",
  angry: "😮",
  other: "👍",
};

function channelFromObject(object?: string): Channel | null {
  if (object === "page") return "facebook";
  if (object === "instagram") return "instagram";
  return null;
}

function firstImageAttachment(attachments?: MetaAttachment[]) {
  const image = attachments?.find((item) => item.type === "image" && item.payload?.url);
  if (!image?.payload?.url) return null;
  return {
    url: image.payload.url,
    name: image.payload.title ?? null,
  };
}

function eventText(event: MetaMessagingEvent) {
  if (event.message?.text) {
    return event.message.text;
  }
  if (firstImageAttachment(event.message?.attachments)) {
    return "[Ảnh]";
  }
  if (event.postback?.title) {
    return `[Postback] ${event.postback.title}`;
  }
  if (event.postback?.payload) {
    return `[Postback] ${event.postback.payload}`;
  }
  return null;
}

function externalMessageId(event: MetaMessagingEvent) {
  return event.message?.mid ?? event.postback?.mid ?? undefined;
}

/** Meta test button thường gửi entry.id = "0" — Page thật nằm ở recipient.id. */
export function resolveMetaExternalAccountId(
  entryId: string | undefined,
  recipientId?: string | null,
) {
  if (recipientId && recipientId !== "0") {
    return recipientId;
  }
  if (entryId && entryId !== "0") {
    return entryId;
  }
  return recipientId || entryId || null;
}

function messagingEventsFromEntry(entry: MetaWebhookEntry): MetaMessagingEvent[] {
  const fromMessaging = entry.messaging ?? [];
  const fromChanges = (entry.changes ?? [])
    .filter((change) => change.field === "messages" && change.value)
    .map((change) => {
      const value = change.value!;
      return {
        sender: value.sender,
        recipient: value.recipient,
        timestamp: value.timestamp,
        message: value.message,
      } satisfies MetaMessagingEvent;
    });
  return [...fromMessaging, ...fromChanges];
}

function reactionEventsFromEntry(entry: MetaWebhookEntry): MetaMessagingEvent[] {
  const fromMessaging = (entry.messaging ?? []).filter((event) => event.reaction?.mid);
  const fromChanges = (entry.changes ?? [])
    .filter((change) => change.field === "message_reactions" && change.value)
    .map((change) => {
      const value = change.value!;
      const mid = value.mid ?? value.message_id;
      return {
        sender: value.sender,
        recipient: value.recipient,
        timestamp: value.timestamp,
        reaction: {
          mid,
          action: value.action,
          emoji: value.emoji,
          reaction: value.reaction,
        },
      } satisfies MetaMessagingEvent;
    });
  return [...fromMessaging, ...fromChanges];
}

export function emojiFromMetaReaction(reaction?: string | null, emoji?: string | null) {
  if (emoji?.trim()) return emoji.trim();
  if (!reaction) return "👍";
  return META_REACTION_TO_EMOJI[reaction.toLowerCase()] ?? "👍";
}

async function ingestMetaReaction(input: {
  channel: Channel;
  externalAccountId: string;
  senderId: string;
  mid: string;
  action?: string;
  emoji?: string | null;
  reaction?: string | null;
}) {
  const account = await prisma.channelAccount.findFirst({
    where: {
      channel: input.channel,
      status: "ready",
      OR: [{ pageId: input.externalAccountId }, { linkedPageId: input.externalAccountId }],
    },
  });
  if (!account) return false;

  const message = await prisma.message.findFirst({
    where: { shopId: account.shopId, externalMessageId: input.mid },
  });
  if (!message) return false;

  const reactorKey = `customer:${input.senderId}`;
  if (input.action === "unreact" || input.action === "react_remove") {
    await removeMessageReaction(message.id, reactorKey);
    return true;
  }

  await upsertMessageReaction({
    shopId: account.shopId,
    messageId: message.id,
    reactorKey,
    emoji: emojiFromMetaReaction(input.reaction, input.emoji),
  });
  return true;
}

export async function processMetaWebhook(body: MetaWebhookBody) {
  const channel = channelFromObject(body.object);
  if (!channel || !body.entry?.length) {
    return { processed: 0, touched: 0, skipped: true };
  }

  let processed = 0;
  let touched = 0;

  for (const entry of body.entry) {
    const events = messagingEventsFromEntry(entry);
    const reactionEvents = reactionEventsFromEntry(entry);
    const accountIds = new Set<string>();

    for (const event of [...events, ...reactionEvents]) {
      const accountId = resolveMetaExternalAccountId(entry.id, event.recipient?.id);
      if (accountId) accountIds.add(accountId);
    }

    if (accountIds.size === 0) {
      const fallback = resolveMetaExternalAccountId(entry.id);
      if (fallback) accountIds.add(fallback);
    }

    for (const accountId of accountIds) {
      const updated = await touchChannelWebhook(channel, accountId);
      if (updated > 0) touched += updated;
    }

    for (const event of events) {
      if (event.message?.is_echo) continue;

      const senderId = event.sender?.id;
      const text = eventText(event);
      const image = firstImageAttachment(event.message?.attachments);
      const externalAccountId = resolveMetaExternalAccountId(entry.id, event.recipient?.id);
      if (!senderId || !text || !externalAccountId) continue;

      const result = await ingestInboundMessage({
        channel,
        externalAccountId,
        senderExternalId: senderId,
        text,
        externalMessageId: externalMessageId(event),
        sentAt: event.timestamp ? new Date(event.timestamp) : undefined,
        attachmentType: image ? "image" : null,
        attachmentUrl: image?.url ?? null,
        attachmentName: image?.name ?? null,
      });

      if (result.ok && !result.duplicate) {
        processed += 1;
      } else if (!result.ok && result.reason === "channel_not_found") {
        console.warn("[webhook/meta] channel_not_found", {
          channel,
          externalAccountId,
          entryId: entry.id,
          recipientId: event.recipient?.id,
        });
      }
    }

    for (const event of reactionEvents) {
      const senderId = event.sender?.id;
      const mid = event.reaction?.mid;
      const externalAccountId = resolveMetaExternalAccountId(entry.id, event.recipient?.id);
      if (!senderId || !mid || !externalAccountId) continue;
      const ok = await ingestMetaReaction({
        channel,
        externalAccountId,
        senderId,
        mid,
        action: event.reaction?.action,
        emoji: event.reaction?.emoji,
        reaction: event.reaction?.reaction,
      });
      if (ok) processed += 1;
    }
  }

  return { processed, touched, skipped: false };
}
