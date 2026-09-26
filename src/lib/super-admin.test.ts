import { describe, expect, it } from "vitest";
import { isPlatformAdminPath, isSuperAdminEmail, parseSuperAdminEmails } from "@/lib/super-admin";

describe("super admin emails", () => {
  it("parses a comma-separated allowlist", () => {
    expect(parseSuperAdminEmails("A@Shop.vn, other@x.co")).toEqual(["a@shop.vn", "other@x.co"]);
  });

  it("matches the configured owner email", () => {
    expect(isSuperAdminEmail("a@shop.vn", "A@Shop.vn")).toBe(true);
    expect(isSuperAdminEmail("staff@shop.vn", "A@Shop.vn")).toBe(false);
  });

  it("recognizes the admin console path", () => {
    expect(isPlatformAdminPath("/admin/shops")).toBe(true);
    expect(isPlatformAdminPath("/staff")).toBe(false);
  });
});
