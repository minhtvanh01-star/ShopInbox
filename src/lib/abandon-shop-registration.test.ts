import { describe, expect, it } from "vitest";
import { abandonIncompleteShopReason } from "./abandon-shop-registration";

const base = {
  isSuperAdmin: false,
  role: "admin",
  setupCompletedAt: null,
  actorStaffId: "staff-1",
  staffIds: ["staff-1"],
  channelCount: 0,
};

describe("abandonIncompleteShopReason", () => {
  it("cho phép chủ shop chưa cấu hình xong", () => {
    expect(abandonIncompleteShopReason(base)).toBeNull();
    expect(abandonIncompleteShopReason({ ...base, role: "owner" })).toBeNull();
  });

  it("chặn super admin, shop đã setup, thêm thành viên, hoặc đã nối kênh", () => {
    expect(abandonIncompleteShopReason({ ...base, isSuperAdmin: true })).toMatch(/nền tảng/);
    expect(
      abandonIncompleteShopReason({ ...base, setupCompletedAt: new Date("2026-09-28") }),
    ).toMatch(/cấu hình xong/);
    expect(abandonIncompleteShopReason({ ...base, role: "staff" })).toMatch(/chủ shop/);
    expect(abandonIncompleteShopReason({ ...base, staffIds: ["staff-1", "staff-2"] })).toMatch(
      /thành viên/,
    );
    expect(abandonIncompleteShopReason({ ...base, staffIds: ["staff-other"] })).toMatch(/thành viên/);
    expect(abandonIncompleteShopReason({ ...base, channelCount: 1 })).toMatch(/kênh/);
  });
});
