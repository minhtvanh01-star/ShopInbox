import { describe, expect, it } from "vitest";
import {
  canAddActiveShopSeat,
  formatShopSeatUsage,
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

  it("respects a custom seat max", () => {
    expect(canAddActiveShopSeat(4, 5)).toBe(true);
    expect(canAddActiveShopSeat(5, 5)).toBe(false);
    expect(shopSeatLimitMessage(10)).toMatch(/10 thành viên/);
  });

  it("returns a clear Vietnamese limit message", () => {
    expect(shopSeatLimitMessage()).toMatch(/3 thành viên/);
    expect(shopSeatLimitMessage()).toMatch(/vô hiệu hóa/);
  });

  it("formats seats used against the shop plan limit", () => {
    expect(formatShopSeatUsage(1, 3)).toBe("1/3");
    expect(formatShopSeatUsage(5, 10)).toBe("5/10");
  });
});
