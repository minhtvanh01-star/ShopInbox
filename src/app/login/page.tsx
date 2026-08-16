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
    auth_message?: string;
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
          Đăng nhập bằng email/mật khẩu hoặc Google đã liên kết. Tài khoản đăng ký mới (email hoặc
          Google) cần quản trị viên phê duyệt và phân quyền trước khi dùng hệ thống.
        </>
      }
    >
      <LoginForm
        shopName={shop?.name ?? "ShopInbox"}
        nextPath={nextPath}
        googleOAuthConfigured={Boolean(getGoogleOAuthConfig())}
        authError={params.auth_error}
        authMessage={params.auth_message}
        authSuccess={params.auth_success}
        resetSuccess={params.reset === "1"}
        idleTimeout={params.reason === "idle"}
      />
    </AuthShell>
  );
}
