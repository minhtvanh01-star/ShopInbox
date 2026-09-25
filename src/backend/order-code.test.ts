import { describe, expect, it } from "vitest";
import { nextOrderCode, normalizeOrderItems, ORDER_ITEM_QTY_MAX } from "@/backend/order-code";

describe("nextOrderCode", () => {
  it("increments the highest DH code", () => {
    expect(nextOrderCode(["DH00010", "DH00012", "DH00011"])).toBe("DH00013");
  });

  it("starts at DH00001 when empty", () => {
    expect(nextOrderCode([])).toBe("DH00001");
  });

  it("ignores malformed codes", () => {
    expect(nextOrderCode(["ABC", "DH12", "DH00009"])).toBe("DH00013");
  });
});

describe("normalizeOrderItems", () => {
  it("drops invalid rows and merges duplicate variants", () => {
    expect(
      normalizeOrderItems([
        { variantId: "pv1", qty: 1 },
        { variantId: "pv1", qty: 2 },
        { variantId: "", qty: 3 },
        { variantId: "pv2", qty: 0 },
      ]),
    ).toEqual([{ variantId: "pv1", qty: 3 }]);
  });

  it("caps quantity at ORDER_ITEM_QTY_MAX", () => {
    expect(normalizeOrderItems([{ variantId: "pv1", qty: ORDER_ITEM_QTY_MAX + 50 }])).toEqual([
      { variantId: "pv1", qty: ORDER_ITEM_QTY_MAX },
    ]);
  });
});
