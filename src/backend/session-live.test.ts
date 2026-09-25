import { describe, expect, it } from "vitest";
import { isLiveStaffSession, sessionVersionOf } from "@/backend/session-live";

describe("isLiveStaffSession", () => {
  const payload = { staffId: "s1", shopId: "shop1", sessionVersion: 0 };
  const staff = { id: "s1", shopId: "shop1", isActive: true, sessionVersion: 0 };

  it("accepts matching active staff", () => {
    expect(isLiveStaffSession(payload, staff)).toBe(true);
  });

  it("rejects inactive, other shop, or bumped version", () => {
    expect(isLiveStaffSession(payload, { ...staff, isActive: false })).toBe(false);
    expect(isLiveStaffSession(payload, { ...staff, shopId: "shop2" })).toBe(false);
    expect(isLiveStaffSession(payload, { ...staff, sessionVersion: 1 })).toBe(false);
    expect(isLiveStaffSession(payload, null)).toBe(false);
  });

  it("treats missing JWT version as 0", () => {
    expect(sessionVersionOf(undefined)).toBe(0);
    expect(isLiveStaffSession({ staffId: "s1", shopId: "shop1" }, staff)).toBe(true);
  });
});
