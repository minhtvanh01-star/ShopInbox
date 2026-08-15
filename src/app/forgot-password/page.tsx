import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { canSendEmailOtp, isEmailConfigured } from "@/backend/email";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-teal-50 via-background to-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-elevated">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-lg font-bold text-white shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">ShopInbox</h1>
            <p className="text-sm text-slate-500">Quên mật khẩu</p>
          </div>
        </div>
        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-6 text-slate-600">
          Nhập email và mật khẩu mới. Hệ thống gửi <strong>mã 6 số qua Gmail</strong> (cùng cơ chế
          đăng ký) để xác minh trước khi đổi mật khẩu. Tài khoản chỉ đăng nhập Google (không có mật
          khẩu) không dùng được luồng này.
        </p>
        <ForgotPasswordForm
          canSendEmailOtp={canSendEmailOtp()}
          emailConfigured={isEmailConfigured()}
        />
      </div>
    </main>
  );
}
