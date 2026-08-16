import { ingestInboundMessage, touchChannelWebhook } from "@/backend/message-sync";

type ZaloWebhookBody = {
  event_name?: string;
  oa_id?: string;
  sender?: { id?: string; name?: string; avatar?: string };
  message?: {
    text?: string;
    msg_id?: string;
  };
  timestamp?: string | number;
};

const TEXT_EVENTS = new Set([
  "user_send_text",
  "user_send_link",
  "user_send_sticker",
  "user_send_image",
  "user_send_gif",
  "user_send_file",
]);

function zaloEventText(body: ZaloWebhookBody) {
  if (body.message?.text) {
    return body.message.text;
  }

  if (body.event_name === "user_send_image") return "[Ảnh]";
  if (body.event_name === "user_send_sticker") return "[Sticker]";
  if (body.event_name === "user_send_gif") return "[GIF]";
  if (body.event_name === "user_send_file") return "[Tệp]";
  if (body.event_name === "user_send_link") return "[Liên kết]";

  return null;
}

function zaloSentAt(timestamp?: string | number) {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    const ms = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
    return new Date(ms);
  }
  if (typeof timestamp === "string" && timestamp.trim()) {
    const parsed = Number.parseInt(timestamp, 10);
    if (Number.isFinite(parsed)) {
      const ms = parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
      return new Date(ms);
    }
  }
  return undefined;
}

export async function processZaloWebhook(body: ZaloWebhookBody) {
  const eventName = body.event_name ?? "";
  if (!TEXT_EVENTS.has(eventName)) {
    return { processed: 0, skipped: true };
  }

  const oaId = body.oa_id;
  const senderId = body.sender?.id;
  const text = zaloEventText(body);

  if (!oaId || !senderId || !text) {
    return { processed: 0, skipped: true };
  }

  await touchChannelWebhook("zalo", oaId);

  const result = await ingestInboundMessage({
    channel: "zalo",
    externalAccountId: oaId,
    senderExternalId: senderId,
    senderName: body.sender?.name,
    senderAvatarUrl: body.sender?.avatar,
    text,
    externalMessageId: body.message?.msg_id,
    sentAt: zaloSentAt(body.timestamp),
  });

  return {
    processed: result.ok && !result.duplicate ? 1 : 0,
    skipped: false,
  };
}
