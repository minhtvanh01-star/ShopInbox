import { describe, expect, it } from "vitest";
import {
  canAddActiveShopSeat,
  MAX_USERS_PER_SHOP,
  shopSeatLimitMessage,
} from "@/lib/shop-seats";

describe("shop seats", () => {
  it("allows up to MAX_USERS_PER_SHOP active members", () => {
    expect(MAX_USERS_PER_SHOP).toBe(3);
    expect(canAddActiveShopSeat(0)).toBe(true);
    expect(canAddActiveShopSeat(2)).toBe(true);
    expect(canAddActiveShopSeat(3)).toBe(false);
    expect(canAddActiveShopSeat(4)).toBe(false);
  });

  it("returns a clear Vietnamese limit message", () => {
    expect(shopSeatLimitMessage()).toMatch(/3 thành viên/);
    expect(shopSeatLimitMessage()).toMatch(/vô hiệu hóa/);
  });
});
