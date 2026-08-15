"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type RegisterActionState } from "@/app/register/actions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { GOOGLE_AUTH_ERROR_MESSAGES } from "@/lib/google-auth-errors";

const initialState: RegisterActionState = {};

type RegisterFormProps = {
  shopName: string;
  nextPath: string;
  googleOAuthConfigured: boolean;
  authError?: string;
  authMessage?: string;
};

export function RegisterForm({
  shopName,
  nextPath,
  googleOAuthConfigured,
  authError,
  authMessage,
}: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  const oauthErrorText = authError
    ? (GOOGLE_AUTH_ERROR_MESSAGES[authError] ?? "Đăng ký Google thất bại.")
    : null;

  return (
    <>
      {googleOAuthConfigured ? (
        <div className="mt-6">
          <GoogleAuthButton
            href={`/api/auth/google/start?mode=register&next=${encodeURIComponent(nextPath)}`}
            label="Đăng ký với Google"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Google xác minh email trước khi tạo tài khoản. Không tự liên kết với tài khoản mật khẩu
            sẵn có.
          </p>
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Đăng ký Google chưa bật — cần cấu hình GOOGLE_CLIENT_ID trên server.
        </p>
      )}

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface px-2 text-slate-400">hoặc email</span>
        </div>
      </div>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="next" value={nextPath} />
        <div className="field-group">
          <label htmlFor="name" className="label mb-0">
            Họ tên
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            className="input-field"
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            className="input-field"
          />
        </div>
        <div className="field-group">
          <label htmlFor="confirmPassword" className="label mb-0">
            Xác nhận mật khẩu
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
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
          {pending ? "Đang tạo tài khoản..." : `Đăng ký ${shopName}`}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Đã có tài khoản?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
