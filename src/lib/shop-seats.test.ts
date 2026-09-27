import { describe, expect, it } from "vitest";
import {
  canAddActiveShopSeat,
  formatShopSeatUsage,
  MAX_USERS_PER_SHOP,
  shopSeatLimitMessage,
  trialPlanSeatWarning,
} from "@/lib/shop-seats";

describe("shop seats", () => {
  it("allows up to MAX_USERS_PER_SHOP active members", () => {
    expect(MAX_USERS_PER_SHOP).toBe(5);
    expect(canAddActiveShopSeat(0)).toBe(true);
    expect(canAddActiveShopSeat(4)).toBe(true);
    expect(canAddActiveShopSeat(5)).toBe(false);
    expect(canAddActiveShopSeat(6)).toBe(false);
  });

  it("respects a custom seat max", () => {
    expect(canAddActiveShopSeat(4, 5)).toBe(true);
    expect(canAddActiveShopSeat(5, 5)).toBe(false);
    expect(shopSeatLimitMessage(10)).toMatch(/10 thành viên/);
  });

  it("returns a clear Vietnamese limit message", () => {
    expect(shopSeatLimitMessage()).toMatch(/5 thành viên/);
    expect(shopSeatLimitMessage()).toMatch(/chạy thử/);
    expect(shopSeatLimitMessage()).toMatch(/vô hiệu hóa/);
  });

  it("formats seats used against the shop plan limit", () => {
    expect(formatShopSeatUsage(1, 5)).toBe("1/5");
    expect(formatShopSeatUsage(5, 5)).toBe("5/5");
  });

  it("cảnh báo bản chạy thử", () => {
    expect(trialPlanSeatWarning()).toMatch(/chạy thử/);
    expect(trialPlanSeatWarning()).toMatch(/mặc định 3/);
    expect(trialPlanSeatWarning()).toMatch(/tối đa 5/);
    expect(trialPlanSeatWarning()).toMatch(/nâng cấp/);
  });
});
