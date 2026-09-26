import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getGoogleOAuthConfig } from "@/backend/google-oauth";
import { canSendRegisterOtp, isEmailConfigured } from "@/backend/email";
import { safeInternalPath } from "@/backend/safe-path";

type RegisterPageProps = {
  searchParams: Promise<{ next?: string; auth_error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);

  return (
    <AuthShell
      title="Đăng ký"
      subtitle="Tạo cửa hàng của bạn"
      intro={
        <>
          Đăng ký bằng email (mã 6 số) hoặc Google. Bạn trở thành <strong>chủ shop</strong> — hệ
          thống tạo cửa hàng riêng, rồi bắt bạn cấu hình tên shop trước khi kết nối kênh hay mời
          nhân viên.
        </>
      }
    >
      <RegisterForm
        nextPath={nextPath}
        googleOAuthConfigured={Boolean(getGoogleOAuthConfig())}
        emailConfigured={isEmailConfigured()}
        canSendRegisterOtp={canSendRegisterOtp()}
        authError={params.auth_error}
      />
    </AuthShell>
  );
}
