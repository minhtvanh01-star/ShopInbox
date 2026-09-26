import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { prisma } from "@/backend/prisma";
import { getGoogleOAuthConfig } from "@/backend/google-oauth";
import { DEMO_SHOP_ID } from "@/lib/queries";
import { safeInternalPath } from "@/backend/safe-path";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    auth_error?: string;
    auth_success?: string;
    reset?: string;
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const shop = await prisma.shop.findUnique({ where: { id: DEMO_SHOP_ID } });
  const nextPath = safeInternalPath(params.next);

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Inbox đa kênh cho cửa hàng"
      intro={
        <>
          Đăng nhập bằng email/mật khẩu hoặc Google đã liên kết. Chủ shop mới đăng ký sẽ vào màn
          cấu hình cửa hàng trước. Nhân viên vào shop bằng link mời, không đăng ký công khai.
        </>
      }
    >
      <LoginForm
        shopName={shop?.name ?? "ShopInbox"}
        nextPath={nextPath}
        googleOAuthConfigured={Boolean(getGoogleOAuthConfig())}
        authError={params.auth_error}
        authSuccess={params.auth_success}
        resetSuccess={params.reset === "1"}
        idleTimeout={params.reason === "idle"}
      />
    </AuthShell>
  );
}
