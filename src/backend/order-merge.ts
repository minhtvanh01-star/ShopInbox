import { prisma } from "@/backend/prisma";

type LineKey = string;

function lineKey(item: {
  productId: string | null;
  variantId?: string | null;
  name: string;
  price: number;
}): LineKey {
  return `${item.productId ?? "x"}|${item.variantId ?? "x"}|${item.name}|${item.price}`;
}

/**
 * Gộp tất cả đơn status=new của một khách vào đơn cũ nhất.
 * Đơn nguồn → cancelled; dòng hàng cộng dồn vào đơn đích.
 */
export async function mergeNewOrdersForCustomer(shopId: string, customerId: string) {
  const open = await prisma.order.findMany({
    where: { shopId, customerId, status: "new" },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  if (open.length < 2) {
    throw new Error("Cần ít nhất 2 đơn đang «Mới» của cùng khách để gộp.");
  }

  const [target, ...sources] = open;
  const qtyByKey = new Map<
    LineKey,
    { productId: string | null; variantId: string | null; name: string; price: number; qty: number }
  >();

  for (const order of open) {
    for (const item of order.items) {
      const key = lineKey(item);
      const current = qtyByKey.get(key);
      if (current) {
        current.qty += item.qty;
      } else {
        qtyByKey.set(key, {
          productId: item.productId,
          variantId: item.variantId ?? null,
          name: item.name,
          price: item.price,
          qty: item.qty,
        });
      }
    }
  }

  const mergedLines = [...qtyByKey.values()];
  const sourceIds = sources.map((order) => order.id);

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: target.id } });
    await tx.orderItem.createMany({
      data: mergedLines.map((line) => ({
        orderId: target.id,
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        qty: line.qty,
        price: line.price,
      })),
    });

    await tx.order.updateMany({
      where: { id: { in: sourceIds }, shopId },
      data: { status: "cancelled" },
    });
  });

  return {
    targetOrderId: target.id,
    targetCode: target.code,
    cancelledCodes: sources.map((order) => order.code),
    lineCount: mergedLines.length,
  };
}
