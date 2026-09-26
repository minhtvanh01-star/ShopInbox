"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
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
  authError?: string;
  authSuccess?: string;
  resetSuccess?: boolean;
  idleTimeout?: boolean;
};

export function LoginForm({
  shopName,
  nextPath,
  googleOAuthConfigured,
  authError,
  authSuccess,
  resetSuccess,
  idleTimeout,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
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
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input-field"
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? errorId : undefined}
          />
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
