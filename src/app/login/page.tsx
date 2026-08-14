import { LoginForm } from "@/components/auth/LoginForm";
import { prisma } from "@/backend/prisma";
import { DEMO_SHOP_ID } from "@/lib/queries";
import { safeInternalPath } from "@/backend/safe-path";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
            <p className="text-sm text-slate-500">Inbox đa kênh cho cửa hàng</p>
          </div>
        </div>
        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-6 text-slate-600">
          Đăng nhập bằng tài khoản nhân viên. Mật khẩu được mã hóa (bcrypt), không lưu plain text.
        </p>
        <LoginForm shopName={shop?.name ?? "ShopInbox"} nextPath={nextPath} />
      </div>
    </main>
  );
}
