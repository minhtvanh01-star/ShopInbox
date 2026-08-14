/** Shared Vietnamese labels + formatters (CHANNEL_LABEL, formatMoney, …). */
import type { Channel, ChannelStatus, ConversationTag, OrderStatus } from "./types";
import { ROLE_LABEL, roleLabel } from "./rbac-catalog";

export const CHANNEL_LABEL: Record<Channel, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  instagram: "Instagram",
  web: "Web",
};

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

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function orderTotal(items: { qty: number; price: number }[]) {
  return items.reduce((sum, item) => sum + item.qty * item.price, 0);
}
