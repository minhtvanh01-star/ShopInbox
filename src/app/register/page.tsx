import { RegisterForm } from "@/components/auth/RegisterForm";
import { prisma } from "@/backend/prisma";
import { getGoogleOAuthConfig } from "@/backend/google-oauth";
import { DEMO_SHOP_ID } from "@/lib/queries";
import { safeInternalPath } from "@/backend/safe-path";

type RegisterPageProps = {
  searchParams: Promise<{ next?: string; auth_error?: string; auth_message?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const shop = await prisma.shop.findUnique({ where: { id: DEMO_SHOP_ID } });
  const nextPath = safeInternalPath(params.next);

  return (
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-teal-50 via-background to-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-elevated">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-lg font-bold text-white shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">ShopInbox</h1>
            <p className="text-sm text-slate-500">Tạo tài khoản mới</p>
          </div>
        </div>
        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-6 text-slate-600">
          Đăng ký bằng Google (OAuth 2.0 + PKCE, email phải đã xác minh) hoặc email/mật khẩu (bcrypt).
          Tài khoản mật khẩu sẵn có không bị tự liên kết Google — phải đăng nhập rồi liên kết trong
          Hồ sơ. User đầu tiên là admin; các tài khoản sau vào shop mặc định với vai trò nhân viên.
        </p>
        <RegisterForm
          shopName={shop?.name ?? "ShopInbox"}
          nextPath={nextPath}
          googleOAuthConfigured={Boolean(getGoogleOAuthConfig())}
          authError={params.auth_error}
          authMessage={params.auth_message}
        />
      </div>
    </main>
  );
}
