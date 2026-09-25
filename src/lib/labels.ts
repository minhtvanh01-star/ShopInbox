/** Shared Vietnamese labels + formatters (CHANNEL_LABEL, formatMoney, …). */
import type { Channel, ChannelStatus, ConversationTag, OrderStatus } from "./types";
import { ROLE_LABEL, roleLabel } from "./rbac-catalog";

/** Múi giờ hiển thị cho toàn bộ UI (Việt Nam, UTC+7, không DST). */
export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const CHANNEL_LABEL: Record<Channel, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  instagram: "Instagram",
  web: "Web",
};

/** Thứ tự kênh trong catalog — nguồn cho bộ lọc Inbox (không hardcode ở UI). */
export const CHANNEL_ORDER = Object.keys(CHANNEL_LABEL) as Channel[];

export type InboxChannelFilter = { id: "all" | Channel; label: string };

/**
 * Bộ lọc kênh Inbox từ CHANNEL_LABEL.
 * Truyền `activeChannels` (kênh đang nối) → chỉ hiện các pill đó;
 * mảng rỗng = chưa nối kênh nào (không fallback catalog).
 */
export function getInboxChannelFilters(activeChannels?: Iterable<Channel>): InboxChannelFilter[] {
  const active = activeChannels ? new Set(activeChannels) : null;
  const channels = active
    ? CHANNEL_ORDER.filter((id) => active.has(id))
    : CHANNEL_ORDER;

  return [
    { id: "all", label: "Tất cả" },
    ...channels.map((id) => ({ id, label: CHANNEL_LABEL[id] })),
  ];
}

export function inboxChannelsSubtitle(filters: InboxChannelFilter[]) {
  const names = filters.filter((item) => item.id !== "all").map((item) => item.label);
  if (names.length === 0) return "Chưa có kênh nào";
  return `Tin nhắn đồng bộ từ ${names.join(", ")}`;
}

export const CHANNEL_STATUS_LABEL: Record<ChannelStatus, string> = {
  disconnected: "Chưa nối",
  connecting: "Đang kết nối",
  ready: "Đã nối",
};

/** Nhãn vai trò từ catalog (admin/staff/manager + alias owner). */
export const STAFF_ROLE_LABEL = ROLE_LABEL;
export { roleLabel };

export const TAG_LABEL: Record<ConversationTag, string> = {
  new: "Mới",
  consulting: "Đang tư vấn",
  closed: "Đã chốt",
  spam: "Spam",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Mới",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

export function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

function vnParts(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TIME_ZONE,
    hourCycle: "h23",
    ...options,
  }).formatToParts(toDate(value));
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
}

/** Giờ ngắn theo Asia/Ho_Chi_Minh (vd. inbox, đơn hàng): `10:09 15/08`. */
export function formatTimeVN(value: string | Date) {
  const p = vnParts(value, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
  return `${p.hour}:${p.minute} ${p.day}/${p.month}`;
}

/** Ngày giờ đầy đủ theo Asia/Ho_Chi_Minh (vd. nhật ký audit): `10:09 15/08/2026`. */
export function formatDateTimeVN(value: string | Date) {
  const p = vnParts(value, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`;
}

export function formatTime(iso: string) {
  return formatTimeVN(iso);
}

export function formatDateTime(iso: string) {
  return formatDateTimeVN(iso);
}

/** Nhãn ngày trên thread chat: Hôm nay / Hôm qua / 15/08/2026. */
export function formatChatDayLabel(iso: string, now: Date = new Date()) {
  const day = vnParts(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
  const today = vnParts(now, { year: "numeric", month: "2-digit", day: "2-digit" });
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = vnParts(yesterdayDate, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (day.year === today.year && day.month === today.month && day.day === today.day) {
    return "Hôm nay";
  }
  if (
    day.year === yesterday.year &&
    day.month === yesterday.month &&
    day.day === yesterday.day
  ) {
    return "Hôm qua";
  }
  return `${day.day}/${day.month}/${day.year}`;
}

/**
 * Parse `YYYY-MM-DD` thành đầu ngày lịch Việt Nam (00:00:00+07).
 * Dùng cho bộ lọc "Từ ngày" trên audit (tránh lệch theo TZ máy chủ).
 */
export function parseVnDayStart(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parse `YYYY-MM-DD` thành cuối ngày lịch Việt Nam (23:59:59.999+07).
 * Dùng cho bộ lọc "Đến ngày" trên audit.
 */
export function parseVnDayEnd(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T23:59:59.999+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function orderTotal(items: { qty: number; price: number }[]) {
  return items.reduce((sum, item) => sum + item.qty * item.price, 0);
}
