import { describe, expect, it } from "vitest";
import { parseShopOpsInput, parseShopPlan, SHOP_PLAN_LABEL } from "@/lib/shop-ops";

describe("shop ops", () => {
  it("accepts a valid plan and support payload", () => {
    const result = parseShopOpsInput({
      planCode: "pro",
      planExpiresAt: "2026-12-31",
      supportStatus: "needs_help",
      supportTopic: "channel",
      supportNote: "  Chưa xong webhook Meta  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.planCode).toBe("pro");
      expect(result.data.supportNote).toBe("Chưa xong webhook Meta");
      expect(result.data.planExpiresAt?.toISOString().startsWith("2026-12-31")).toBe(true);
    }
  });

  it("rejects an unknown plan", () => {
    expect(parseShopPlan("enterprise")).toBeNull();
    expect(parseShopOpsInput({ planCode: "gold" }).ok).toBe(false);
  });

  it("labels plans in Vietnamese / product names", () => {
    expect(SHOP_PLAN_LABEL.trial).toBe("Dùng thử");
  });
});
