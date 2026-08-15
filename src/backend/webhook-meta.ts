import { ingestInboundMessage, touchChannelWebhook } from "@/backend/message-sync";
import type { Channel } from "@/lib/types";

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
  };
  postback?: {
    mid?: string;
    title?: string;
    payload?: string;
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
    };
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

function channelFromObject(object?: string): Channel | null {
  if (object === "page") return "facebook";
  if (object === "instagram") return "instagram";
  return null;
}

function eventText(event: MetaMessagingEvent) {
  if (event.message?.text) {
    return event.message.text;
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

export async function processMetaWebhook(body: MetaWebhookBody) {
  const channel = channelFromObject(body.object);
  if (!channel || !body.entry?.length) {
    return { processed: 0, touched: 0, skipped: true };
  }

  let processed = 0;
  let touched = 0;

  for (const entry of body.entry) {
    const events = messagingEventsFromEntry(entry);
    const accountIds = new Set<string>();

    for (const event of events) {
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
      const externalAccountId = resolveMetaExternalAccountId(entry.id, event.recipient?.id);
      if (!senderId || !text || !externalAccountId) continue;

      const result = await ingestInboundMessage({
        channel,
        externalAccountId,
        senderExternalId: senderId,
        text,
        externalMessageId: externalMessageId(event),
        sentAt: event.timestamp ? new Date(event.timestamp) : undefined,
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
  }

  return { processed, touched, skipped: false };
}
