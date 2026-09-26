import { describe, expect, it } from "vitest";
import { defaultShopNameFromOwner, validateShopName } from "@/lib/shop-name";

describe("validateShopName", () => {
  it("trims and accepts a normal name", () => {
    expect(validateShopName("  Lily Boutique  ")).toEqual({ ok: true, name: "Lily Boutique" });
  });

  it("rejects a too-short name", () => {
    const result = validateShopName("A");
    expect(result.ok).toBe(false);
  });
});

describe("defaultShopNameFromOwner", () => {
  it("builds a placeholder from the owner name", () => {
    expect(defaultShopNameFromOwner("Minh")).toBe("Cửa hàng của Minh");
  });
});
