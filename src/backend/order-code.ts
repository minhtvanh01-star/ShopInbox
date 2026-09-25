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

export const ORDER_ITEM_QTY_MAX = 999;

export type DraftOrderItem = {
  variantId: string;
  qty: number;
};

export function normalizeOrderItems(items: DraftOrderItem[]) {
  const merged = new Map<string, number>();
  for (const item of items) {
    const variantId = String(item.variantId ?? "").trim();
    const qty = Math.floor(Number(item.qty));
    if (!variantId || !Number.isFinite(qty) || qty < 1) continue;
    const next = Math.min(ORDER_ITEM_QTY_MAX, (merged.get(variantId) ?? 0) + qty);
    merged.set(variantId, next);
  }
  return [...merged.entries()].map(([variantId, qty]) => ({ variantId, qty }));
}
