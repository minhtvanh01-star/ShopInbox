import { describe, expect, it } from "vitest";
import { isShopSetupExemptPath, isShopSetupPending, postAuthPath } from "@/lib/shop-setup";

describe("shop setup gate", () => {
  it("treats missing flag as already configured (legacy sessions)", () => {
    expect(isShopSetupPending({})).toBe(false);
    expect(isShopSetupPending({ shopSetupComplete: true })).toBe(false);
    expect(isShopSetupPending({ shopSetupComplete: false })).toBe(true);
  });

  it("sends pending owners to personal-info first, then they continue to shop setup", () => {
    expect(postAuthPath({ shopSetupComplete: false }, "/inbox")).toBe("/register/profile");
    expect(postAuthPath({ shopSetupComplete: true }, "/orders")).toBe("/orders");
  });

  it("keeps profile onboarding and shop setup reachable while setup is pending", () => {
    expect(isShopSetupExemptPath("/register/profile")).toBe(true);
    expect(isShopSetupExemptPath("/setup")).toBe(true);
    expect(isShopSetupExemptPath("/inbox")).toBe(false);
  });

  it("sends super admin to the shop directory", () => {
    expect(postAuthPath({ shopSetupComplete: false, isSuperAdmin: true }, "/inbox")).toBe(
      "/admin/shops",
    );
    expect(postAuthPath({ shopSetupComplete: true, isSuperAdmin: true }, "/orders")).toBe(
      "/admin/shops",
    );
    expect(postAuthPath({ shopSetupComplete: true, isSuperAdmin: true }, "/admin/shops/abc")).toBe(
      "/admin/shops/abc",
    );
  });

  it("does not send super admin through shop onboarding", () => {
    expect(isShopSetupPending({ shopSetupComplete: false, isSuperAdmin: true })).toBe(false);
  });
});
