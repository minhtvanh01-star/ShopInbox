import { RegisterForm } from "@/components/auth/RegisterForm";
import { prisma } from "@/backend/prisma";
import { getGoogleOAuthConfig } from "@/backend/google-oauth";
import { canSendRegisterOtp, isEmailConfigured } from "@/backend/email";
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
          Đăng ký email sẽ nhận <strong>mã 6 số qua Gmail</strong> trước khi tạo tài khoản. Hoặc dùng
          Google. User đầu tiên là admin và dùng ngay; các tài khoản sau cần quản trị viên phê duyệt
          và phân quyền trước khi đăng nhập.
        </p>
        <RegisterForm
          shopName={shop?.name ?? "ShopInbox"}
          nextPath={nextPath}
          googleOAuthConfigured={Boolean(getGoogleOAuthConfig())}
          emailConfigured={isEmailConfigured()}
          canSendRegisterOtp={canSendRegisterOtp()}
          authError={params.auth_error}
          authMessage={params.auth_message}
        />
      </div>
    </main>
  );
}
