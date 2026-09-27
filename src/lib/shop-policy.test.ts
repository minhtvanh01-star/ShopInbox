import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOP_POLICY,
  normalizeMaxUsersPerShop,
  normalizeReplyClaimTtlMinutes,
  parseShopPolicyInput,
  replyClaimTtlMs,
} from "./shop-policy";

describe("shop-policy", () => {
  it("converts minutes to ms", () => {
    expect(replyClaimTtlMs(15)).toBe(15 * 60 * 1000);
    expect(replyClaimTtlMs()).toBe(DEFAULT_SHOP_POLICY.replyClaimTtlMinutes * 60 * 1000);
  });

  it("validates claim TTL range", () => {
    expect(normalizeReplyClaimTtlMinutes(5)).toBe(5);
    expect(normalizeReplyClaimTtlMinutes(120)).toBe(120);
    expect(normalizeReplyClaimTtlMinutes(4)).toBeNull();
    expect(normalizeReplyClaimTtlMinutes(121)).toBeNull();
    expect(normalizeReplyClaimTtlMinutes("abc")).toBeNull();
  });

  it("validates max users range", () => {
    expect(DEFAULT_SHOP_POLICY.maxUsersPerShop).toBe(3);
    expect(normalizeMaxUsersPerShop(1)).toBe(1);
    expect(normalizeMaxUsersPerShop(3)).toBe(3);
    expect(normalizeMaxUsersPerShop(5)).toBe(5);
    expect(normalizeMaxUsersPerShop(0)).toBeNull();
    expect(normalizeMaxUsersPerShop(6)).toBeNull();
    expect(normalizeMaxUsersPerShop(50)).toBeNull();
  });

  it("parses policy input", () => {
    expect(parseShopPolicyInput({ replyClaimTtlMinutes: 10, maxUsersPerShop: 5 })).toEqual({
      ok: true,
      policy: { replyClaimTtlMinutes: 10, maxUsersPerShop: 5 },
    });
    expect(parseShopPolicyInput({ replyClaimTtlMinutes: 0, maxUsersPerShop: 3 }).ok).toBe(false);
  });
});
