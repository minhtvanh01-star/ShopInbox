import { describe, expect, it } from "vitest";
import { isShopSetupPending, postAuthPath } from "@/lib/shop-setup";

describe("shop setup gate", () => {
  it("treats missing flag as already configured (legacy sessions)", () => {
    expect(isShopSetupPending({})).toBe(false);
    expect(isShopSetupPending({ shopSetupComplete: true })).toBe(false);
    expect(isShopSetupPending({ shopSetupComplete: false })).toBe(true);
  });

  it("sends pending owners to /setup instead of next", () => {
    expect(postAuthPath({ shopSetupComplete: false }, "/inbox")).toBe("/setup");
    expect(postAuthPath({ shopSetupComplete: true }, "/orders")).toBe("/orders");
  });

  it("sends super admin to the shop directory", () => {
    expect(postAuthPath({ shopSetupComplete: false, isSuperAdmin: true }, "/inbox")).toBe(
      "/admin/shops",
    );
    expect(postAuthPath({ shopSetupComplete: true, isSuperAdmin: true }, "/orders")).toBe(
      "/orders",
    );
  });
});
