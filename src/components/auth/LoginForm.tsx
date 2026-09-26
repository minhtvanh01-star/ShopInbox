"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction, type AuthActionState } from "@/app/login/actions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import {
  AUTH_SUCCESS_MESSAGES,
  GOOGLE_AUTH_ERROR_MESSAGES,
} from "@/lib/google-auth-errors";

const initialState: AuthActionState = {};

type LoginFormProps = {
  shopName: string;
  nextPath: string;
  googleOAuthConfigured: boolean;
  googleLocalRedirect?: boolean;
  authError?: string;
  authSuccess?: string;
  resetSuccess?: boolean;
  idleTimeout?: boolean;
};

export function LoginForm({
  shopName,
  nextPath,
  googleOAuthConfigured,
  googleLocalRedirect,
  authError,
  authSuccess,
  resetSuccess,
  idleTimeout,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const errorId = "login-form-error";

  const oauthErrorText = authError
    ? (GOOGLE_AUTH_ERROR_MESSAGES[authError] ?? "Đăng nhập Google thất bại.")
    : null;
  const successText = authSuccess ? (AUTH_SUCCESS_MESSAGES[authSuccess] ?? null) : null;
  const hasBanner = Boolean(idleTimeout || resetSuccess || successText);
  const formError = state.error || oauthErrorText;

  useEffect(() => {
    if (formError) {
      errorRef.current?.focus();
    }
  }, [formError]);

  return (
    <>
      {idleTimeout ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Phiên đăng nhập đã hết vì không hoạt động quá 30 phút. Vui lòng đăng nhập lại.
        </p>
      ) : null}
      {resetSuccess ? (
        <p
          className={`${idleTimeout ? "mt-4" : "mt-6"} rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800`}
        >
          Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.
        </p>
      ) : null}
      {successText ? (
        <p
          className={`${idleTimeout || resetSuccess ? "mt-4" : "mt-6"} rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800`}
        >
          {successText}
        </p>
      ) : null}

      <form action={formAction} className={`${hasBanner ? "mt-4" : "mt-6"} space-y-5`} noValidate>
        <input type="hidden" name="next" value={nextPath} />

        {formError ? (
          <p
            ref={errorRef}
            id={errorId}
            role="alert"
            tabIndex={-1}
            className="alert-error outline-none"
          >
            {state.error ?? oauthErrorText}
          </p>
        ) : null}

        <div className="field-group">
          <label htmlFor="email" className="label mb-0">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="input-field"
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? errorId : undefined}
          />
        </div>

        <div className="field-group">
          <div className="mb-0 flex items-center justify-between gap-2">
            <label htmlFor="password" className="label mb-0">
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="input-field pr-11"
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? errorId : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn-primary w-full"
        >
          {pending ? "Đang đăng nhập…" : `Đăng nhập ${shopName}`}
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
        <div>
          <GoogleAuthButton
            href={`/api/auth/google/start?mode=login&next=${encodeURIComponent(nextPath)}`}
            label="Tiếp tục với Google"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Tài khoản tạo bằng Google thì dùng nút này, không nhập mật khẩu.
          </p>
          {googleLocalRedirect ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Server đang gửi Google về localhost. Trên VPS đặt{" "}
              <span className="font-medium">GOOGLE_REDIRECT_URI</span> =
              https://&lt;domain&gt;/api/auth/google/callback (khớp ô Authorized redirect URIs),
              rồi restart — không cần rebuild.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Đăng nhập Google chưa được bật trên server.
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
    </>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.5 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.3 4.3" />
      <path d="M6.7 6.7C4.2 8.4 2.5 11 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.7" />
    </svg>
  );
}
