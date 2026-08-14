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

type MetaWebhookEntry = {
  id?: string;
  time?: number;
  messaging?: MetaMessagingEvent[];
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

export async function processMetaWebhook(body: MetaWebhookBody) {
  const channel = channelFromObject(body.object);
  if (!channel || !body.entry?.length) {
    return { processed: 0, skipped: true };
  }

  let processed = 0;

  for (const entry of body.entry) {
    const externalAccountId = entry.id;
    if (!externalAccountId) continue;

    await touchChannelWebhook(channel, externalAccountId);

    for (const event of entry.messaging ?? []) {
      if (event.message?.is_echo) continue;

      const senderId = event.sender?.id;
      const text = eventText(event);
      if (!senderId || !text) continue;

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
      }
    }
  }

  return { processed, skipped: false };
}
