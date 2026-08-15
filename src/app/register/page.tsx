import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";
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
    <AuthShell
      title="Đăng ký"
      subtitle="Tạo tài khoản mới"
      intro={
        <>
          Đăng ký email sẽ nhận <strong>mã 6 số qua Gmail</strong> trước khi tạo tài khoản. Hoặc dùng
          Google. User đầu tiên là admin và dùng ngay; các tài khoản sau cần quản trị viên phê duyệt
          và phân quyền trước khi đăng nhập.
        </>
      }
    >
      <RegisterForm
        shopName={shop?.name ?? "ShopInbox"}
        nextPath={nextPath}
        googleOAuthConfigured={Boolean(getGoogleOAuthConfig())}
        emailConfigured={isEmailConfigured()}
        canSendRegisterOtp={canSendRegisterOtp()}
        authError={params.auth_error}
        authMessage={params.auth_message}
      />
    </AuthShell>
  );
}
