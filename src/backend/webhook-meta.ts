import {
  applyMetaMessageWatermark,
  findChannelAccount,
  ingestInboundMessage,
  ingestShopEchoMessage,
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

type MetaDelivery = {
  mids?: string[];
  watermark?: number;
  seq?: number;
};

type MetaRead = {
  watermark?: number;
  seq?: number;
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
  delivery?: MetaDelivery;
  read?: MetaRead;
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
    mids?: string[];
    watermark?: number;
    delivery?: MetaDelivery;
    read?: MetaRead;
  };
};

type MetaWebhookEntry = {
  id?: string;
  time?: number;
  messaging?: MetaMessagingEvent[];
  changes?: MetaWebhookChange[];
};

export type MetaWebhookBody = {
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
    type: "image" as const,
    url: image.payload.url,
    name: image.payload.title ?? null,
  };
}

/** Ảnh / video / audio / file có URL — lưu để Inbox hiển thị (không chỉ placeholder). */
function firstRenderableAttachment(attachments?: MetaAttachment[]) {
  const image = firstImageAttachment(attachments);
  if (image) return image;

  const preferred = ["video", "audio", "file"] as const;
  for (const type of preferred) {
    const hit = attachments?.find((item) => item.type === type && item.payload?.url);
    if (hit?.payload?.url) {
      return {
        type,
        url: hit.payload.url,
        name: hit.payload.title ?? null,
      };
    }
  }
  return null;
}

function attachmentPlaceholder(attachments?: MetaAttachment[]) {
  if (!attachments?.length) return null;
  if (attachments.some((item) => item.type === "image")) return "[Ảnh]";
  if (attachments.some((item) => item.type === "video")) return "[Video]";
  if (attachments.some((item) => item.type === "audio")) return "[Audio]";
  if (attachments.some((item) => item.type === "file")) return "[File]";
  return "[Đính kèm]";
}

function eventText(event: MetaMessagingEvent) {
  if (event.message?.text) {
    return event.message.text;
  }
  const fromAttachment = attachmentPlaceholder(event.message?.attachments);
  if (fromAttachment) {
    return fromAttachment;
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

const META_DELIVERY_FIELDS = new Set(["message_deliveries"]);
const META_READ_FIELDS = new Set(["message_reads", "messaging_seen"]);

/**
 * Page/staff echo: sender là Page (entry.id) hoặc trùng recipient.
 * Read/delivery thật: sender = PSID/IGSID khách, recipient = Page.
 */
export function isMetaReceiptFromPage(input: {
  senderId?: string | null;
  recipientId?: string | null;
  entryId?: string | null;
}) {
  const senderId = input.senderId?.trim();
  if (!senderId) return true;
  const entryId = input.entryId && input.entryId !== "0" ? input.entryId : null;
  const recipientId = input.recipientId && input.recipientId !== "0" ? input.recipientId : null;
  if (entryId && senderId === entryId) return true;
  if (recipientId && senderId === recipientId) return true;
  return false;
}

/** delivery / read từ messaging[] hoặc changes (message_deliveries / message_reads / messaging_seen). */
function receiptEventsFromEntry(entry: MetaWebhookEntry): MetaMessagingEvent[] {
  const fromMessaging = (entry.messaging ?? []).filter(
    (event) => event.delivery?.watermark || event.read?.watermark,
  );
  const fromChanges = (entry.changes ?? [])
    .filter(
      (change) =>
        (META_DELIVERY_FIELDS.has(change.field ?? "") ||
          META_READ_FIELDS.has(change.field ?? "")) &&
        change.value,
    )
    .map((change) => {
      const value = change.value!;
      const field = change.field ?? "";
      const delivery = META_DELIVERY_FIELDS.has(field)
        ? (value.delivery ?? {
            watermark: value.watermark,
            mids: value.mids,
          })
        : undefined;
      const read = META_READ_FIELDS.has(field)
        ? (value.read ?? { watermark: value.watermark })
        : undefined;
      return {
        sender: value.sender,
        recipient: value.recipient,
        timestamp: value.timestamp,
        delivery,
        read,
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
  const account = await findChannelAccount(input.channel, input.externalAccountId);
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
    const receiptEvents = receiptEventsFromEntry(entry);
    const accountIds = new Set<string>();

    for (const event of [...events, ...reactionEvents, ...receiptEvents]) {
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
      if (event.delivery || event.read) continue;

      const senderId = event.sender?.id;
      const text = eventText(event);
      const media = firstRenderableAttachment(event.message?.attachments);
      const pageIsSender = isMetaReceiptFromPage({
        senderId,
        recipientId: event.recipient?.id,
        entryId: entry.id,
      });

      if (event.message?.is_echo || pageIsSender) {
        const pageId = resolveMetaExternalAccountId(entry.id, pageIsSender ? senderId : null);
        const customerExternalId =
          event.recipient?.id && event.recipient.id !== pageId
            ? event.recipient.id
            : !pageIsSender
              ? senderId
              : null;
        if (pageId && customerExternalId && text) {
          const echo = await ingestShopEchoMessage({
            channel,
            externalAccountId: pageId,
            customerExternalId,
            text,
            externalMessageId: externalMessageId(event),
            sentAt: event.timestamp ? new Date(event.timestamp) : undefined,
          });
          if (echo.ok && !("duplicate" in echo && echo.duplicate)) {
            processed += 1;
          }
        }
        continue;
      }

      const externalAccountId = resolveMetaExternalAccountId(entry.id, event.recipient?.id);
      if (!senderId || !text || !externalAccountId) continue;

      const result = await ingestInboundMessage({
        channel,
        externalAccountId,
        senderExternalId: senderId,
        text,
        externalMessageId: externalMessageId(event),
        sentAt: event.timestamp ? new Date(event.timestamp) : undefined,
        attachmentType: media?.type ?? null,
        attachmentUrl: media?.url ?? null,
        attachmentName: media?.name ?? null,
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

    for (const event of receiptEvents) {
      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;
      if (
        isMetaReceiptFromPage({
          senderId,
          recipientId,
          entryId: entry.id,
        })
      ) {
        continue;
      }
      const externalAccountId = resolveMetaExternalAccountId(entry.id, recipientId);
      if (!senderId || !externalAccountId) continue;

      if (event.delivery?.watermark) {
        const result = await applyMetaMessageWatermark({
          channel,
          externalAccountId,
          customerExternalId: senderId,
          watermarkMs: event.delivery.watermark,
          kind: "delivered",
          mids: event.delivery.mids,
        });
        if (result.ok && result.updated > 0) processed += 1;
      }

      if (event.read?.watermark) {
        const result = await applyMetaMessageWatermark({
          channel,
          externalAccountId,
          customerExternalId: senderId,
          watermarkMs: event.read.watermark,
          kind: "read",
        });
        if (result.ok && result.updated > 0) processed += 1;
      }
    }
  }

  return { processed, touched, skipped: false };
}
