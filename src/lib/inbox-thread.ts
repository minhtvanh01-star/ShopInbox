import type { Message, MessageLocalStatus } from "@/lib/types";

export type { MessageLocalStatus };

export type LocalOutboundMessage = Message & {
  localStatus: MessageLocalStatus;
};

/** Khóa ngày lịch VN `YYYY-MM-DD` để nhóm tin theo ngày. */
export function chatDayKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Gộp tin server + tin đang gửi/thất bại (local).
 * Ghép 1-1 với tin shop trên server (tránh nuốt tin trùng nội dung gửi liên tiếp).
 */
export function mergeConversationThread(
  serverMessages: Message[],
  localOutbound: LocalOutboundMessage[],
  conversationId: string,
): Array<Message & { localStatus?: MessageLocalStatus }> {
  const server = serverMessages.filter((item) => item.conversationId === conversationId);
  const local = localOutbound.filter((item) => item.conversationId === conversationId);
  const keptLocal = keepUnmatchedLocal(local, server);

  return [...server, ...keptLocal].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );
}

/** Bỏ local đã có cặp trên server (kể cả failed — race gửi OK nhưng client báo lỗi). */
export function pruneSyncedOutbound(
  localOutbound: LocalOutboundMessage[],
  serverMessages: Message[],
): LocalOutboundMessage[] {
  return keepUnmatchedLocal(localOutbound, serverMessages);
}

function keepUnmatchedLocal(
  localOutbound: LocalOutboundMessage[],
  serverMessages: Message[],
): LocalOutboundMessage[] {
  const usedServerIds = new Set<string>();
  return localOutbound.filter((pending) => {
    const pool = serverMessages.filter((item) => item.conversationId === pending.conversationId);
    const twin = findBestServerTwin(pool, pending, usedServerIds);
    if (!twin) return true;
    usedServerIds.add(twin.id);
    return false;
  });
}

/**
 * Tìm đúng 1 tin shop trên server khớp pending (thời gian gần + nội dung/tên ảnh).
 * Mỗi server message chỉ ghép một pending.
 */
function findBestServerTwin(
  server: Message[],
  pending: LocalOutboundMessage,
  usedServerIds: Set<string>,
): Message | null {
  let best: Message | null = null;
  let bestDt = Number.POSITIVE_INFINITY;

  for (const item of server) {
    if (usedServerIds.has(item.id)) continue;
    if (item.sender !== "shop") continue;
    const dt = Math.abs(+new Date(item.createdAt) - +new Date(pending.createdAt));
    if (dt > 120_000) continue;

    const isImage = Boolean(pending.attachmentType === "image" || pending.attachmentUrl);
    if (isImage) {
      const serverImage =
        Boolean(item.attachmentUrl) ||
        item.attachmentType === "image" ||
        item.text === "[Ảnh]";
      if (!serverImage) continue;
      if (
        pending.attachmentName &&
        item.attachmentName &&
        pending.attachmentName !== item.attachmentName
      ) {
        continue;
      }
    } else if (item.text !== pending.text) {
      continue;
    }

    if (dt < bestDt) {
      best = item;
      bestDt = dt;
    }
  }

  return best;
}
