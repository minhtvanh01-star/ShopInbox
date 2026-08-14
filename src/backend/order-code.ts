/** Sinh mã đơn tiếp theo dạng DH00013 từ các mã hiện có. */
export function nextOrderCode(existingCodes: string[]) {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^DH(\d+)$/i.exec(code.trim());
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return `DH${String(max + 1).padStart(5, "0")}`;
}

export type DraftOrderItem = {
  productId: string;
  qty: number;
};

export function normalizeOrderItems(items: DraftOrderItem[]) {
  const merged = new Map<string, number>();
  for (const item of items) {
    const productId = item.productId.trim();
    const qty = Math.floor(Number(item.qty));
    if (!productId || !Number.isFinite(qty) || qty < 1) continue;
    merged.set(productId, (merged.get(productId) ?? 0) + qty);
  }
  return [...merged.entries()].map(([productId, qty]) => ({ productId, qty }));
}
