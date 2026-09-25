import type { OrderStatus } from "@/lib/types";
import { VN_TIME_ZONE } from "@/lib/labels";

export type OrderSummaryView = "day" | "month" | "year";

export type OrderSummaryBucket = {
  key: string;
  label: string;
  orderCount: number;
  revenue: number;
  cancelledCount: number;
  cancelledAmount: number;
  byStatus: Record<OrderStatus, number>;
  from?: string;
  to?: string;
};

function vnParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return { year, month, day };
}

export function emptyOrderStatusCounts(): Record<OrderStatus, number> {
  return { new: 0, confirmed: 0, shipping: 0, done: 0, cancelled: 0 };
}

export function bucketKeyForView(date: Date, view: OrderSummaryView) {
  const { year, month, day } = vnParts(date);
  if (view === "year") return year;
  if (view === "month") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

export function bucketLabel(key: string, view: OrderSummaryView) {
  if (view === "year") return `Năm ${key}`;
  if (view === "month") {
    const [y, m] = key.split("-");
    return `Tháng ${m}/${y}`;
  }
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}
