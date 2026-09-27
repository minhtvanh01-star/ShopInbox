"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  registerAction,
  resendRegisterOtpAction,
  verifyRegisterOtpAction,
  type RegisterActionState,
} from "@/app/register/actions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { GOOGLE_AUTH_ERROR_MESSAGES } from "@/lib/google-auth-errors";

const initialState: RegisterActionState = { step: "form" };
/** Khớp EMAIL_OTP_RESEND_COOLDOWN_MS trên server (không import file có node:crypto vào client). */
const RESEND_COOLDOWN_SEC = 60;

type RegisterFormProps = {
  nextPath: string;
  googleOAuthConfigured: boolean;
  /** SMTP/Gmail đã cấu hình. */
  emailConfigured: boolean;
  /** Có thể gửi OTP (SMTP hoặc EMAIL_OTP_DEV_LOG=1). */
  canSendRegisterOtp: boolean;
  /** DB trống — cho tạo tài khoản đầu tiên không cần SMTP. */
  firstRun?: boolean;
  authError?: string;
};

export function RegisterForm({
  nextPath,
  googleOAuthConfigured,
  emailConfigured,
  canSendRegisterOtp,
  firstRun = false,
  authError,
}: RegisterFormProps) {
  const router = useRouter();
  const canSubmit = canSendRegisterOtp || firstRun;
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    initialState,
  );
  const [verifyState, verifyFormAction, verifyPending] = useActionState(
    verifyRegisterOtpAction,
    initialState,
  );
  const [resendState, resendFormAction, resendPending] = useActionState(
    resendRegisterOtpAction,
    initialState,
  );

  /** Một nguồn sự thật cho bước UI — sync khi action state đổi (pattern adjust-state-on-render). */
  const [view, setView] = useState<"form" | "otp">("form");
  const [otpEmail, setOtpEmail] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const otpErrorRef = useRef<HTMLParagraphElement>(null);
  const formErrorId = "register-form-error";
  const otpErrorId = "register-otp-error";

  const [prevRegister, setPrevRegister] = useState(registerState);
  if (registerState !== prevRegister) {
    setPrevRegister(registerState);
    if (registerState.step === "otp" && registerState.email) {
      setView("otp");
      setOtpEmail(registerState.email);
      setDraftEmail(registerState.email);
      setResendCooldownSec(RESEND_COOLDOWN_SEC);
    }
  }

  const [prevResend, setPrevResend] = useState(resendState);
  if (resendState !== prevResend) {
    setPrevResend(resendState);
    if (resendState.step === "otp" && resendState.email) {
      setView("otp");
      setOtpEmail(resendState.email);
      setDraftEmail(resendState.email);
      if (resendState.message) {
        setResendCooldownSec(RESEND_COOLDOWN_SEC);
      }
    } else if (resendState.step === "form") {
      setView("form");
    }
  }

  const [prevVerify, setPrevVerify] = useState(verifyState);
  if (verifyState !== prevVerify) {
    setPrevVerify(verifyState);
    if (verifyState.step === "form" && verifyState.error) {
      setView("form");
      if (verifyState.email) {
        setDraftEmail(verifyState.email);
      }
    }
  }

  useEffect(() => {
    if (resendCooldownSec <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setResendCooldownSec((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldownSec]);

  const oauthErrorText = authError
    ? (GOOGLE_AUTH_ERROR_MESSAGES[authError] ?? "Đăng ký Google thất bại.")
    : null;

  const otpMessage =
    (resendState.step === "otp" ? resendState.message : undefined) ||
    (registerState.step === "otp" ? registerState.message : undefined);

  const otpError =
    view === "otp"
      ? (verifyState.step !== "form" ? verifyState.error : undefined) ||
        (resendState.step === "otp" ? resendState.error : undefined)
      : undefined;

  const formError =
    view === "form"
      ? registerState.error ||
        (verifyState.step === "form" ? verifyState.error : undefined) ||
        (resendState.step === "form" ? resendState.error : undefined)
      : undefined;

  const resendBlocked = resendPending || resendCooldownSec > 0;
  const formAlert = formError || oauthErrorText;

  useEffect(() => {
    if (otpError) {
      otpErrorRef.current?.focus();
    }
  }, [otpError]);

  useEffect(() => {
    if (formAlert) {
      formErrorRef.current?.focus();
    }
  }, [formAlert]);

  useEffect(() => {
    const next = registerState.redirectTo || verifyState.redirectTo;
    if (next) {
      router.replace(next);
    }
  }, [registerState.redirectTo, verifyState.redirectTo, router]);

  if (view === "otp" && otpEmail) {
    return (
      <div className="mt-6 space-y-5">
        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-6 text-slate-600">
          Nhập mã 6 số đã gửi tới <strong className="text-slate-800">{otpEmail}</strong>.
          Mã có hiệu lực 10 phút.
        </p>
        {otpMessage ? (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {otpMessage}
          </p>
        ) : null}
        <form action={verifyFormAction} className="space-y-5">
          <input type="hidden" name="email" value={otpEmail} />
          <input type="hidden" name="next" value={nextPath} />
          {otpError ? (
            <p
              ref={otpErrorRef}
              id={otpErrorId}
              role="alert"
              tabIndex={-1}
              className="alert-error outline-none"
            >
              {otpError}
            </p>
          ) : null}
          <div className="field-group">
            <label htmlFor="code" className="label mb-0">
              Mã xác thực
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              className="input-field tracking-[0.35em] text-center text-lg"
              placeholder="000000"
              aria-invalid={otpError ? true : undefined}
              aria-describedby={otpError ? otpErrorId : undefined}
            />
            <p className="text-xs text-slate-500">Dán mã từ email được. Không cần gõ tay từng số.</p>
          </div>
          <button
            type="submit"
            disabled={verifyPending}
            aria-busy={verifyPending}
            className="btn-primary w-full"
          >
            {verifyPending ? "Đang xác thực…" : "Xác nhận và tạo tài khoản"}
          </button>
        </form>
        <form action={resendFormAction} className="flex flex-col gap-2">
          <input type="hidden" name="email" value={otpEmail} />
          <button
            type="submit"
            disabled={resendBlocked}
            className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline disabled:opacity-60"
          >
            {resendPending
              ? "Đang gửi lại..."
              : resendCooldownSec > 0
                ? `Gửi lại mã (${resendCooldownSec}s)`
                : "Gửi lại mã"}
          </button>
        </form>
        <button
          type="button"
          className="w-full text-center text-sm text-slate-500 hover:text-slate-700 hover:underline"
          onClick={() => setView("form")}
        >
          ← Đổi email / quay lại form
        </button>
      </div>
    );
  }

  return (
    <>
      {googleOAuthConfigured ? (
        <div className="mt-6">
          <GoogleAuthButton
            href={`/api/auth/google/start?mode=register&next=${encodeURIComponent(nextPath)}`}
            label="Đăng ký với Google"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Chọn Google để tạo shop. Sau đó bạn nhập họ tên và số điện thoại, rồi mới cấu hình cửa
            hàng.
          </p>
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Đăng ký Google chưa được bật trên server.
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

      {firstRun ? (
        <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900">
          Đây là tài khoản đầu tiên trên hệ thống. Điền form là vào được ngay, không cần mã email.
        </p>
      ) : !canSendRegisterOtp ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Gửi mã email chưa được cấu hình trên server. Liên hệ quản trị viên.
        </p>
      ) : !emailConfigured ? (
        <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
          Chế độ phát triển: mã xác thực được ghi ra nhật ký server, chưa gửi email.
        </p>
      ) : null}

      <form
        action={registerFormAction}
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          setDraftName(String(data.get("name") ?? ""));
          setDraftEmail(String(data.get("email") ?? "").trim().toLowerCase());
        }}
        className="space-y-5"
      >
        <input type="hidden" name="next" value={nextPath} />
        {formAlert ? (
          <p
            ref={formErrorRef}
            id={formErrorId}
            role="alert"
            tabIndex={-1}
            className="alert-error outline-none"
          >
            {formError ?? oauthErrorText}
          </p>
        ) : null}
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
            defaultValue={draftName}
            className="input-field"
            aria-invalid={formAlert ? true : undefined}
            aria-describedby={formAlert ? formErrorId : undefined}
          />
        </div>
        <div className="field-group">
          <label htmlFor="email" className="label mb-0">
            Email (Gmail)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={draftEmail}
            className="input-field"
            aria-invalid={formAlert ? true : undefined}
            aria-describedby={formAlert ? formErrorId : undefined}
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
            aria-invalid={formAlert ? true : undefined}
            aria-describedby={formAlert ? `${formErrorId} password-hint` : "password-hint"}
          />
          <p id="password-hint" className="text-xs text-slate-500">
            Tối thiểu 8 ký tự. Trình quản lý mật khẩu được phép điền sẵn.
          </p>
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
            aria-invalid={formAlert ? true : undefined}
            aria-describedby={formAlert ? formErrorId : undefined}
          />
        </div>
        <button
          type="submit"
          disabled={registerPending || !canSubmit || Boolean(registerState.redirectTo)}
          aria-busy={registerPending}
          className="btn-primary w-full"
        >
            {registerPending || registerState.redirectTo
              ? firstRun
                ? "Đang tạo tài khoản…"
                : "Đang gửi mã…"
              : firstRun
                ? "Tạo tài khoản đầu tiên"
                : "Gửi mã xác thực"}
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
