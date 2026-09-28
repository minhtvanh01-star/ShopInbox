import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { canSendEmailOtp, isEmailConfigured } from "@/backend/email";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Đặt lại mật khẩu"
      intro="Nhập email và mật khẩu mới. Mã xác thực gửi về email."
    >
      <ForgotPasswordForm
        canSendEmailOtp={canSendEmailOtp()}
        emailConfigured={isEmailConfigured()}
      />
    </AuthShell>
  );
}
