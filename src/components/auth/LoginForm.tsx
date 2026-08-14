"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/app/login/actions";

const initialState: AuthActionState = {};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google OAuth chưa được cấu hình trên server.",
  google_denied: "Bạn đã hủy đăng nhập Google.",
  google_invalid: "Phản hồi Google không hợp lệ.",
  google_state: "Phiên OAuth hết hạn hoặc không khớp — thử lại.",
  google_failed: "Đăng nhập Google thất bại.",
  google_email_unverified: "Email Google chưa được xác minh.",
  google_email_linked_other: "Email đã liên kết tài khoản Google khác.",
  inactive: "Tài khoản đã bị vô hiệu hóa. Liên hệ admin shop.",
};

type LoginFormProps = {
  shopName: string;
  nextPath: string;
  googleOAuthConfigured: boolean;
  authError?: string;
  authMessage?: string;
};

export function LoginForm({
  shopName,
  nextPath,
  googleOAuthConfigured,
  authError,
  authMessage,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  const oauthErrorText = authError
    ? AUTH_ERROR_MESSAGES[authError] ?? "Đăng nhập Google thất bại."
    : null;

  return (
    <>
      <form action={formAction} className="mt-6 space-y-5">
        <input type="hidden" name="next" value={nextPath} />
        <div className="field-group">
          <label htmlFor="email" className="label mb-0">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue="admin@lily.vn"
            className="input-field"
          />
        </div>
        <div className="field-group">
          <label htmlFor="password" className="label mb-0">
            Mật khẩu
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input-field"
          />
        </div>
        {state.error ? <p className="alert-error">{state.error}</p> : null}
        {oauthErrorText ? (
          <p className="alert-error">
            {oauthErrorText}
            {authMessage ? ` (${authMessage})` : null}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Đang đăng nhập..." : `Đăng nhập ${shopName}`}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface px-2 text-slate-400">hoặc</span>
        </div>
      </div>

      {googleOAuthConfigured ? (
        <a
          href={`/api/auth/google/start?next=${encodeURIComponent(nextPath)}`}
          className="btn-secondary flex w-full items-center justify-center gap-2 border-teal-200 text-teal-800 hover:bg-teal-50"
        >
          <GoogleIcon />
          Đăng nhập với Google
        </a>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Đăng nhập Google chưa bật — cần cấu hình GOOGLE_CLIENT_ID trên server.
        </p>
      )}

      <div className="mt-6 rounded-lg border border-border bg-surface-muted px-4 py-3 text-xs leading-5 text-slate-500">
        <p className="font-medium text-slate-600">Tài khoản demo</p>
        <p className="mt-1">
          Admin: <code className="rounded bg-white px-1 text-slate-700">admin@lily.vn</code> /{" "}
          <code className="rounded bg-white px-1 text-slate-700">Admin@123</code>
        </p>
        <p className="mt-1">
          Nhân viên: <code className="rounded bg-white px-1 text-slate-700">nhanvien@lily.vn</code>{" "}
          / <code className="rounded bg-white px-1 text-slate-700">Staff@123</code>
        </p>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
