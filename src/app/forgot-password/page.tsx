import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { canSendEmailOtp, isEmailConfigured } from "@/backend/email";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Đặt lại mật khẩu"
      intro={
        <>
          Nhập email và mật khẩu mới. Hệ thống gửi <strong>mã 6 số qua email</strong> để xác minh
          trước khi đổi hoặc thêm mật khẩu. Tài khoản chỉ đăng nhập Google cũng dùng được luồng này
          để thêm mật khẩu đăng nhập ngoài.
        </>
      }
    >
      <ForgotPasswordForm
        canSendEmailOtp={canSendEmailOtp()}
        emailConfigured={isEmailConfigured()}
      />
    </AuthShell>
  );
}
