import { REGISTER_MIN_PASSWORD_LENGTH } from "@/lib/auth-password";
import { parseSuperAdminEmails } from "@/lib/super-admin";

export const LOGIN_DB_ERROR =
  "Không kết nối được dữ liệu. Trên VPS kiểm tra DATABASE_URL (Postgres) rồi triển khai lại.";

/** DB trống — người đầu tiên tạo tài khoản ngay, không chờ SMTP. */
export function shouldSkipRegisterOtp(staffCount: number) {
  return staffCount === 0;
}

export function readFirstAdminBootstrap(env: Record<string, string | undefined>) {
  const email = parseSuperAdminEmails(env.SUPER_ADMIN_EMAIL)[0];
  const password = (env.SUPER_ADMIN_PASSWORD ?? env.BOOTSTRAP_ADMIN_PASSWORD ?? "").trim();
  const name = (env.SUPER_ADMIN_NAME ?? "").trim() || "Super admin";
  if (!email || password.length < REGISTER_MIN_PASSWORD_LENGTH) return null;
  return { email, password, name };
}
