import { describe, expect, it } from "vitest";
import {
  canShopStaffMutateMember,
  isPlatformAdminPath,
  isSuperAdminAllowedPath,
  isSuperAdminEmail,
  parseSuperAdminEmails,
  shouldBlockLastActiveSuperAdmin,
  pickFirstSuperAdminStaffId,
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

  it("keeps super admin off inbox and channel pages", () => {
    expect(isSuperAdminAllowedPath("/admin/shops")).toBe(true);
    expect(isSuperAdminAllowedPath("/settings/profile")).toBe(true);
    expect(isSuperAdminAllowedPath("/inbox")).toBe(false);
    expect(isSuperAdminAllowedPath("/settings")).toBe(false);
    expect(isSuperAdminAllowedPath("/api/health")).toBe(true);
    expect(isSuperAdminAllowedPath("/api/uploads/shop1/a.jpg")).toBe(true);
    expect(isSuperAdminAllowedPath("/api/connect/meta/start")).toBe(false);
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

  it("bootstraps the first shop admin when env is empty and nobody is Super admin", () => {
    expect(
      shouldBootstrapSuperAdmin({
        isSuperAdmin: false,
        email: "admin@lily.vn",
        existingSuperAdminCount: 0,
        roleCode: "admin",
      }),
    ).toBe(true);
    expect(
      shouldBootstrapSuperAdmin({
        isSuperAdmin: false,
        email: "nhanvien@lily.vn",
        existingSuperAdminCount: 0,
        roleCode: "staff",
      }),
    ).toBe(false);
  });

  it("picks allowlisted staff then the oldest shop admin", () => {
    const older = new Date("2026-01-01");
    const newer = new Date("2026-06-01");
    expect(
      pickFirstSuperAdminStaffId({
        existingSuperAdminCount: 0,
        allowlist: "boss@shop.vn",
        staff: [
          { id: "a1", email: "admin@lily.vn", roleCode: "admin", createdAt: older },
          { id: "b1", email: "boss@shop.vn", roleCode: "staff", createdAt: newer },
        ],
      }),
    ).toBe("b1");
    expect(
      pickFirstSuperAdminStaffId({
        existingSuperAdminCount: 0,
        staff: [
          { id: "a2", email: "later@shop.vn", roleCode: "admin", createdAt: newer },
          { id: "a1", email: "admin@lily.vn", roleCode: "admin", createdAt: older },
        ],
      }),
    ).toBe("a1");
    expect(
      pickFirstSuperAdminStaffId({
        existingSuperAdminCount: 1,
        staff: [{ id: "a1", email: "admin@lily.vn", roleCode: "admin", createdAt: older }],
      }),
    ).toBeNull();
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

  it("blocks shop staff from mutating a Super admin", () => {
    expect(
      canShopStaffMutateMember({ actorIsSuperAdmin: false, targetIsSuperAdmin: true }),
    ).toBe(false);
    expect(
      canShopStaffMutateMember({ actorIsSuperAdmin: true, targetIsSuperAdmin: true }),
    ).toBe(true);
    expect(
      canShopStaffMutateMember({ actorIsSuperAdmin: false, targetIsSuperAdmin: false }),
    ).toBe(true);
  });

  it("blocks disabling the last active Super admin", () => {
    expect(
      shouldBlockLastActiveSuperAdmin({
        targetIsSuperAdmin: true,
        nextIsActive: false,
        otherActiveSuperAdminCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldBlockLastActiveSuperAdmin({
        targetIsSuperAdmin: true,
        nextIsActive: false,
        otherActiveSuperAdminCount: 1,
      }),
    ).toBe(false);
  });
});
