export const SUPER_ADMIN_HOME = "/admin/shops";

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
}) {
  if (input.isSuperAdmin) return false;
  if (input.existingSuperAdminCount > 0) return false;
  return isSuperAdminEmail(input.email, input.allowlist);
}

export function isSuperAdminSession(session: { isSuperAdmin?: boolean } | null | undefined) {
  return session?.isSuperAdmin === true;
}

export function isPlatformAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
