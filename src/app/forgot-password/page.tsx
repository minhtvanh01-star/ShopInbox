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
          Nhập email và mật khẩu mới. Hệ thống gửi <strong>mã 6 số qua Gmail</strong> (cùng cơ chế
          đăng ký) để xác minh trước khi đổi mật khẩu. Tài khoản chỉ đăng nhập Google (không có mật
          khẩu) không dùng được luồng này.
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
