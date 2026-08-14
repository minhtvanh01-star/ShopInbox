import { describe, expect, it } from "vitest";
import { nextOrderCode, normalizeOrderItems } from "@/backend/order-code";

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
  it("drops invalid rows and merges duplicate products", () => {
    expect(
      normalizeOrderItems([
        { productId: "p1", qty: 1 },
        { productId: "p1", qty: 2 },
        { productId: "", qty: 3 },
        { productId: "p2", qty: 0 },
      ]),
    ).toEqual([
      { productId: "p1", qty: 3 },
    ]);
  });
});
