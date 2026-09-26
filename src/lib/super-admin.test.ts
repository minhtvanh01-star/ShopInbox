import { describe, expect, it } from "vitest";
import {
  isPlatformAdminPath,
  isSuperAdminEmail,
  parseSuperAdminEmails,
  shouldBootstrapSuperAdmin,
} from "@/lib/super-admin";

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

  it("bootstraps SUPER_ADMIN_EMAIL only when no super admin exists", () => {
    expect(
      shouldBootstrapSuperAdmin({
        isSuperAdmin: false,
        email: "owner@shop.vn",
        existingSuperAdminCount: 0,
        allowlist: "owner@shop.vn",
      }),
    ).toBe(true);
    expect(
      shouldBootstrapSuperAdmin({
        isSuperAdmin: false,
        email: "owner@shop.vn",
        existingSuperAdminCount: 1,
        allowlist: "owner@shop.vn",
      }),
    ).toBe(false);
  });

  it("does not re-grant after revoke just because env still matches", () => {
    expect(
      shouldBootstrapSuperAdmin({
        isSuperAdmin: false,
        email: "owner@shop.vn",
        existingSuperAdminCount: 1,
        allowlist: "owner@shop.vn",
      }),
    ).toBe(false);
  });
});
