"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/app/login/actions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { GOOGLE_AUTH_ERROR_MESSAGES } from "@/lib/google-auth-errors";

const initialState: AuthActionState = {};

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
    ? (GOOGLE_AUTH_ERROR_MESSAGES[authError] ?? "Đăng nhập Google thất bại.")
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
        <GoogleAuthButton
          href={`/api/auth/google/start?mode=login&next=${encodeURIComponent(nextPath)}`}
          label="Đăng nhập với Google"
        />
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Đăng nhập Google chưa bật — cần cấu hình GOOGLE_CLIENT_ID trên server.
        </p>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Chưa có tài khoản?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
        >
          Đăng ký
        </Link>
      </p>

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
