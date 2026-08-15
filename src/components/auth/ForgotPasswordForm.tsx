"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  requestPasswordResetAction,
  resendPasswordResetOtpAction,
  verifyPasswordResetOtpAction,
  type ForgotPasswordActionState,
} from "@/app/forgot-password/actions";
import { REGISTER_MIN_PASSWORD_LENGTH } from "@/lib/auth-password";

const initialState: ForgotPasswordActionState = { step: "form" };
const RESEND_COOLDOWN_SEC = 60;

type ForgotPasswordFormProps = {
  canSendEmailOtp: boolean;
  emailConfigured: boolean;
};

export function ForgotPasswordForm({
  canSendEmailOtp,
  emailConfigured,
}: ForgotPasswordFormProps) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyPasswordResetOtpAction,
    initialState,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendPasswordResetOtpAction,
    initialState,
  );

  const [view, setView] = useState<"form" | "otp">("form");
  const [otpEmail, setOtpEmail] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [resendCooldownSec, setResendCooldownSec] = useState(0);

  const [prevRequest, setPrevRequest] = useState(requestState);
  if (requestState !== prevRequest) {
    setPrevRequest(requestState);
    if (requestState.step === "otp" && requestState.email) {
      setView("otp");
      setOtpEmail(requestState.email);
      setDraftEmail(requestState.email);
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

  const otpMessage =
    (resendState.step === "otp" ? resendState.message : undefined) ||
    (requestState.step === "otp" ? requestState.message : undefined);

  const otpError =
    view === "otp"
      ? (verifyState.step !== "form" ? verifyState.error : undefined) ||
        (resendState.step === "otp" ? resendState.error : undefined)
      : undefined;

  const formError =
    view === "form"
      ? requestState.error ||
        (verifyState.step === "form" ? verifyState.error : undefined) ||
        (resendState.step === "form" ? resendState.error : undefined)
      : undefined;

  const resendBlocked = resendPending || resendCooldownSec > 0;

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
        <form action={verifyAction} className="space-y-5">
          <input type="hidden" name="email" value={otpEmail} />
          <div className="field-group">
            <label htmlFor="code" className="label mb-0">
              Mã xác minh
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
            />
          </div>
          {otpError ? <p className="alert-error">{otpError}</p> : null}
          <button type="submit" disabled={verifyPending} className="btn-primary w-full">
            {verifyPending ? "Đang xác minh..." : "Xác nhận và đổi mật khẩu"}
          </button>
        </form>
        <form action={resendAction} className="flex flex-col gap-2">
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
          onClick={() => {
            setView("form");
            setOtpEmail("");
          }}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-700 hover:underline"
        >
          Quay lại form
        </button>
        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-teal-700 hover:underline">
            Về đăng nhập
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={requestAction} className="mt-6 space-y-5">
      {!canSendEmailOtp ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Chưa bật gửi mã email. Cấu hình Gmail/SMTP hoặc{" "}
          <code className="rounded bg-white px-1">EMAIL_OTP_DEV_LOG=1</code> rồi restart.
        </p>
      ) : !emailConfigured ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
          Chế độ dev: mã OTP in ra console server (chưa cấu hình SMTP).
        </p>
      ) : null}

      <div className="field-group">
        <label htmlFor="email" className="label mb-0">
          Email tài khoản
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={draftEmail}
          onChange={(event) => setDraftEmail(event.target.value)}
          className="input-field"
        />
      </div>
      <div className="field-group">
        <label htmlFor="password" className="label mb-0">
          Mật khẩu mới
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={REGISTER_MIN_PASSWORD_LENGTH}
          className="input-field"
        />
      </div>
      <div className="field-group">
        <label htmlFor="confirmPassword" className="label mb-0">
          Xác nhận mật khẩu mới
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={REGISTER_MIN_PASSWORD_LENGTH}
          className="input-field"
        />
      </div>
      {formError ? <p className="alert-error">{formError}</p> : null}
      <button
        type="submit"
        disabled={requestPending || !canSendEmailOtp}
        className="btn-primary w-full"
      >
        {requestPending ? "Đang gửi mã..." : "Gửi mã xác minh"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Nhớ mật khẩu?{" "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
