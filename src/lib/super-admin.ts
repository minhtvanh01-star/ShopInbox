export const SUPER_ADMIN_HOME = "/admin/shops";

/** Shop kỹ thuật cho Super admin — không phải cửa hàng khách. */
export const PLATFORM_SHOP_ID = "platform";
export const PLATFORM_SHOP_NAME = "Nền tảng";

export function isPlatformShopId(shopId: string) {
  return shopId === PLATFORM_SHOP_ID;
}

export function parseSuperAdminEmails(raw = process.env.SUPER_ADMIN_EMAIL) {
  return String(raw ?? "")
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string, raw = process.env.SUPER_ADMIN_EMAIL) {
  const needle = email.trim().toLowerCase();
  if (!needle) return false;
  return parseSuperAdminEmails(raw).includes(needle);
}

/** Chỉ bootstrap khi chưa có Super admin nào — env không ghi đè quyền đã gỡ. */
export function shouldBootstrapSuperAdmin(input: {
  isSuperAdmin: boolean;
  email: string;
  existingSuperAdminCount: number;
  allowlist?: string;
  roleCode?: string;
}) {
  if (input.isSuperAdmin) return false;
  if (input.existingSuperAdminCount > 0) return false;
  return isSuperAdminEmail(input.email, input.allowlist);
}

/** Chỉ gán Super admin lần đầu khi email khớp SUPER_ADMIN_EMAIL — không lấy chủ shop. */
export function pickFirstSuperAdminStaffId(input: {
  existingSuperAdminCount: number;
  allowlist?: string;
  staff: Array<{ id: string; email: string; roleCode: string; createdAt: Date }>;
}) {
  if (input.existingSuperAdminCount > 0) return null;
  return input.staff.find((row) => isSuperAdminEmail(row.email, input.allowlist))?.id ?? null;
}

export function isSuperAdminSession(session: { isSuperAdmin?: boolean } | null | undefined) {
  return session?.isSuperAdmin === true;
}

/** Shop `staffManage` không được reset/tắt Super admin nền tảng. */
export function canShopStaffMutateMember(input: {
  actorIsSuperAdmin: boolean;
  targetIsSuperAdmin: boolean;
}) {
  return !input.targetIsSuperAdmin || input.actorIsSuperAdmin;
}

export const SUPER_ADMIN_SHOP_MUTATION_BLOCKED =
  "Không thể đổi tài khoản Super admin từ trang nhân viên shop.";

/** Không tắt Super admin cuối cùng còn hoạt động. */
export function shouldBlockLastActiveSuperAdmin(input: {
  targetIsSuperAdmin: boolean;
  nextIsActive: boolean;
  otherActiveSuperAdminCount: number;
}) {
  if (!input.targetIsSuperAdmin || input.nextIsActive) return false;
  return input.otherActiveSuperAdminCount <= 0;
}

export const LAST_SUPER_ADMIN_DISABLE_BLOCKED = "Phải còn ít nhất một Super admin đang hoạt động.";

export function isPlatformAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

const SUPER_ADMIN_API_PREFIXES = ["/api/health", "/api/auth/", "/api/uploads/", "/api/cron/"];

/** Super admin chỉ ở console nền tảng — không vào inbox / kênh hội thoại. */
export function isSuperAdminAllowedPath(pathname: string) {
  if (pathname.startsWith("/api/")) {
    return SUPER_ADMIN_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    );
  }
  if (pathname === "/setup" || pathname.startsWith("/setup/")) return true;
  if (pathname === "/settings/profile" || pathname.startsWith("/settings/profile/")) {
    return true;
  }
  return isPlatformAdminPath(pathname);
}
