import { LoginForm } from "@/components/LoginForm";
import { prisma } from "@/lib/prisma";
import { DEMO_SHOP_ID } from "@/lib/queries";
import { safeInternalPath } from "@/lib/safe-path";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const shop = await prisma.shop.findUnique({ where: { id: DEMO_SHOP_ID } });
  const nextPath = safeInternalPath(params.next);

  return (
    <main className="flex min-h-full items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-lg font-bold text-white">
            S
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">ShopInbox</h1>
            <p className="text-sm text-slate-500">Inbox đa kênh cho cửa hàng</p>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Đăng nhập bằng tài khoản nhân viên. Mật khẩu được lưu dạng mã hóa (bcrypt), không lưu
          plain text.
        </p>
        <LoginForm shopName={shop?.name ?? "ShopInbox"} nextPath={nextPath} />
      </div>
    </main>
  );
}
