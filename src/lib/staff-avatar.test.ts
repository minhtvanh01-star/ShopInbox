import { describe, expect, it } from "vitest";
import {
  isAllowedStaffAvatarUrl,
  STAFF_AVATAR_MAX_BYTES,
  validateStaffAvatarFile,
} from "@/lib/staff-avatar";

describe("staff avatar", () => {
  it("allows empty, https, and local upload paths", () => {
    expect(isAllowedStaffAvatarUrl("")).toBe(true);
    expect(isAllowedStaffAvatarUrl("https://cdn.example.com/a.png")).toBe(true);
    expect(isAllowedStaffAvatarUrl("/api/uploads/shop1/abc.jpg")).toBe(true);
    expect(isAllowedStaffAvatarUrl("ftp://bad")).toBe(false);
    expect(isAllowedStaffAvatarUrl("/api/uploads/../secret")).toBe(false);
  });

  it("rejects oversized or unsupported files", () => {
    expect(validateStaffAvatarFile({ type: "image/png", size: 1200 }).ok).toBe(true);
    expect(validateStaffAvatarFile({ type: "image/png", size: STAFF_AVATAR_MAX_BYTES + 1 }).ok).toBe(
      false,
    );
    expect(validateStaffAvatarFile({ type: "application/pdf", size: 100 }).ok).toBe(false);
  });
});
