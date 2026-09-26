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

export function isSuperAdminSession(session: { isSuperAdmin?: boolean } | null | undefined) {
  return session?.isSuperAdmin === true;
}

export function isPlatformAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
