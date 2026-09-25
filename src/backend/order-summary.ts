import { prisma } from "@/backend/prisma";
import { parseVnDayEnd, parseVnDayStart } from "@/lib/labels";
import {
  bucketKeyForView,
  bucketLabel,
  emptyOrderStatusCounts,
  type OrderSummaryBucket,
  type OrderSummaryView,
} from "@/lib/order-summary";

export type { OrderSummaryBucket, OrderSummaryView } from "@/lib/order-summary";
export { bucketKeyForView, bucketLabel } from "@/lib/order-summary";

export async function getOrderSummary(
  shopId: string,
  options: {
    view?: OrderSummaryView;
    from?: string;
    to?: string;
    status?: string;
  } = {},
) {
  const view: OrderSummaryView =
    options.view === "month" || options.view === "year" ? options.view : "day";
  const statusRaw = options.status?.trim() ?? "";
  const status =
    statusRaw === "new" ||
    statusRaw === "confirmed" ||
    statusRaw === "shipping" ||
    statusRaw === "done" ||
    statusRaw === "cancelled"
      ? statusRaw
      : undefined;

  const from = parseVnDayStart(options.from);
  const to = parseVnDayEnd(options.to);

  const orders = await prisma.order.findMany({
    where: {
      shopId,
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: { items: { select: { qty: true, price: true } } },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, OrderSummaryBucket>();

  for (const order of orders) {
    const key = bucketKeyForView(order.createdAt, view);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: bucketLabel(key, view),
        orderCount: 0,
        revenue: 0,
        cancelledCount: 0,
        cancelledAmount: 0,
        byStatus: emptyOrderStatusCounts(),
        ...(view === "day" ? { from: key, to: key } : {}),
      };
      map.set(key, bucket);
    }

    const amount = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    bucket.orderCount += 1;
    bucket.byStatus[order.status] += 1;
    if (order.status === "cancelled") {
      bucket.cancelledCount += 1;
      bucket.cancelledAmount += amount;
    } else {
      bucket.revenue += amount;
    }
  }

  const buckets = [...map.values()].sort((a, b) => b.key.localeCompare(a.key));

  const totals = buckets.reduce(
    (acc, row) => {
      acc.orderCount += row.orderCount;
      acc.revenue += row.revenue;
      acc.cancelledCount += row.cancelledCount;
      acc.cancelledAmount += row.cancelledAmount;
      return acc;
    },
    { orderCount: 0, revenue: 0, cancelledCount: 0, cancelledAmount: 0 },
  );

  return { view, buckets, totals };
}
