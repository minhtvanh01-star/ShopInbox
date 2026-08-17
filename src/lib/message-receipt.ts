/** Trạng thái tick tin shop outbound — 1 xám (đã gửi) hoặc 2 xanh (khách đã xem). */
export type OutboundReceiptState = "sent" | "read";

export type MessageReceiptPatch = {
  deliveredAt?: string | null;
  readAt?: string | null;
};

type ReceiptMessage = {
  id: string;
  deliveredAt?: string | null;
  readAt?: string | null;
};

/** Chỉ `readAt` từ Meta (khách mở thread) → 2 tick xanh. Delivery không đổi UI. */
export function outboundReceiptState(message: {
  readAt?: string | null;
  deliveredAt?: string | null;
}): OutboundReceiptState {
  return message.readAt ? "read" : "sent";
}

export function applyMessageReceipts<T extends ReceiptMessage>(
  messages: T[],
  overlay: Record<string, MessageReceiptPatch>,
): T[] {
  if (Object.keys(overlay).length === 0) return messages;
  return messages.map((message) => {
    const patch = overlay[message.id];
    if (!patch) return message;
    const deliveredAt = patch.deliveredAt || message.deliveredAt || null;
    const readAt = patch.readAt || message.readAt || null;
    if (deliveredAt === (message.deliveredAt ?? null) && readAt === (message.readAt ?? null)) {
      return message;
    }
    return { ...message, deliveredAt, readAt };
  });
}

export function mergeReceiptOverlay(
  prev: Record<string, MessageReceiptPatch>,
  rows: Array<{ id: string; deliveredAt: string | null; readAt: string | null }>,
): Record<string, MessageReceiptPatch> {
  if (rows.length === 0) return prev;
  let changed = false;
  const next = { ...prev };
  for (const row of rows) {
    const existing = next[row.id];
    const deliveredAt = row.deliveredAt || existing?.deliveredAt || null;
    const readAt = row.readAt || existing?.readAt || null;
    if (existing?.deliveredAt === deliveredAt && existing?.readAt === readAt) continue;
    next[row.id] = { deliveredAt, readAt };
    changed = true;
  }
  return changed ? next : prev;
}
