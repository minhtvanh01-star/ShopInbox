"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  confirmProfilePasswordOtpAction,
  confirmProfileVerifyOtpAction,
  requestProfilePasswordOtpAction,
  requestProfileVerifyOtpAction,
  updateAvatarAction,
  updateProfileAction,
  type ProfileActionState,
  type ProfileOtpActionState,
} from "@/app/(app)/settings/profile/actions";
import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { GOOGLE_AUTH_ERROR_MESSAGES } from "@/lib/google-auth-errors";
import { STAFF_AVATAR_MAX_MB } from "@/lib/staff-avatar";

const initialState: ProfileActionState = {};
const initialOtpState: ProfileOtpActionState = {};

type ProfileFormProps = {
  profile: {
    name: string;
    emailMasked: string;
    phone: string;
    avatarUrl: string;
    authMethod: "google" | "email" | "both";
    emailVerified: boolean;
    hasPassword: boolean;
    canSendEmailOtp: boolean;
    canLinkGoogle: boolean;
    googleOAuthConfigured: boolean;
  };
  flash?: {
    success?: string;
    error?: string;
  };
};

const AUTH_ERROR_MESSAGES = GOOGLE_AUTH_ERROR_MESSAGES;

function authBadgeLabel(method: ProfileFormProps["profile"]["authMethod"]) {
  if (method === "both") return "Email + Google";
  if (method === "google") return "Google";
  return "Email";
}

export function ProfileForm({ profile, flash }: ProfileFormProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [avatarState, avatarAction, avatarPending] = useActionState(
    updateAvatarAction,
    initialState,
  );
  const [verifyRequestState, verifyRequestAction, verifyRequestPending] = useActionState(
    requestProfileVerifyOtpAction,
    initialOtpState,
  );
  const [verifyConfirmState, verifyConfirmAction, verifyConfirmPending] = useActionState(
    confirmProfileVerifyOtpAction,
    initialOtpState,
  );
  const [passwordRequestState, passwordRequestAction, passwordRequestPending] = useActionState(
    requestProfilePasswordOtpAction,
    initialOtpState,
  );
  const [passwordConfirmState, passwordConfirmAction, passwordConfirmPending] = useActionState(
    confirmProfilePasswordOtpAction,
    initialOtpState,
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verifyStep, setVerifyStep] = useState<"form" | "otp">("form");
  const [passwordStep, setPasswordStep] = useState<"form" | "otp">("form");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const [prevVerifyRequest, setPrevVerifyRequest] = useState(verifyRequestState);
  if (verifyRequestState !== prevVerifyRequest) {
    setPrevVerifyRequest(verifyRequestState);
    if (verifyRequestState.step === "otp") setVerifyStep("otp");
    if (verifyRequestState.success) setVerifyStep("form");
  }

  const [prevPasswordRequest, setPrevPasswordRequest] = useState(passwordRequestState);
  if (passwordRequestState !== prevPasswordRequest) {
    setPrevPasswordRequest(passwordRequestState);
    if (passwordRequestState.step === "otp") setPasswordStep("otp");
    if (passwordRequestState.success) setPasswordStep("form");
  }

  const [prevPasswordConfirm, setPrevPasswordConfirm] = useState(passwordConfirmState);
  if (passwordConfirmState !== prevPasswordConfirm) {
    setPrevPasswordConfirm(passwordConfirmState);
    if (passwordConfirmState.success) setPasswordStep("form");
    if (passwordConfirmState.step === "form" && passwordConfirmState.error) {
      setPasswordStep("form");
    }
  }

  const flashMessage = flash?.success
    ? { type: "success" as const, text: AUTH_ERROR_MESSAGES[flash.success] ?? flash.success }
    : flash?.error
      ? { type: "error" as const, text: AUTH_ERROR_MESSAGES[flash.error] ?? flash.error }
      : null;

  const verifyError = verifyConfirmState.error || verifyRequestState.error;
  const verifySuccess = verifyConfirmState.success || verifyRequestState.success;
  const passwordError = passwordConfirmState.error || passwordRequestState.error;
  const passwordSuccess = passwordConfirmState.success || passwordRequestState.success;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header shrink-0 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <h1 className="page-title">Hồ sơ cá nhân</h1>
        <p className="page-subtitle">Cập nhật thông tin và phương thức đăng nhập của bạn.</p>
      </header>

      {flashMessage ? (
        <div
          className={`shrink-0 border-b px-6 py-3 text-sm ${
            flashMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <section className="card-padded">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Thông tin cơ bản</h2>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200 ring-inset">
                {authBadgeLabel(profile.authMethod)}
              </span>
            </div>

          <form action={avatarAction} className="mb-5">
            <input
              ref={avatarInputRef}
              id="avatar"
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(file));
                event.currentTarget.form?.requestSubmit();
              }}
            />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarPending}
                aria-label={profile.avatarUrl ? "Đổi ảnh đại diện" : "Thêm ảnh đại diện"}
                className="group relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed"
              >
                <StaffAvatar
                  name={profile.name}
                  avatarUrl={previewUrl ?? profile.avatarUrl}
                  size="lg"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/55 text-[11px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {avatarPending ? "Đang lưu…" : profile.avatarUrl || previewUrl ? "Đổi ảnh" : "Thêm ảnh"}
                </span>
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">Ảnh đại diện</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Bấm vào ảnh để thêm hoặc đổi. JPEG, PNG, WebP, GIF · tối đa {STAFF_AVATAR_MAX_MB}MB.
                  Ảnh lưu xong sẽ hiện cho đồng nghiệp.
                </p>
              </div>
            </div>
            {avatarState.error ? (
              <p role="alert" className="alert-error mt-3">
                {avatarState.error}
              </p>
            ) : null}
            {avatarState.success ? (
              <p role="status" className="alert-success mt-3">
                {avatarState.success}
              </p>
            ) : null}
          </form>

          <form action={profileAction} className="space-y-4">
            <div className="field-group">
              <label htmlFor="name" className="label mb-0">
                Họ tên
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={profile.name}
                className="input-field"
              />
            </div>

            <div className="field-group">
              <span className="label mb-0">Email</span>
              <p className="input-field bg-surface-muted text-slate-600">{profile.emailMasked}</p>
              <p className="mt-1 text-xs text-slate-400">
                Email đã che một phần. Đổi mật khẩu hoặc xác nhận hồ sơ dùng mã OTP gửi tới hộp thư
                này.
              </p>
            </div>

            <div className="field-group">
              <label htmlFor="phone" className="label mb-0">
                Số điện thoại (tuỳ chọn)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone}
                placeholder="0901 234 567"
                className="input-field"
              />
            </div>

            {profileState.error ? (
              <p role="alert" className="alert-error">
                {profileState.error}
              </p>
            ) : null}
            {profileState.success ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {profileState.success}
              </p>
            ) : null}

            <button type="submit" disabled={profilePending} className="btn-primary">
              {profilePending ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
          </form>
        </section>

        <div className="space-y-6">
          <section className="card-padded">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Xác nhận hồ sơ</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                  profile.emailVerified
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-amber-50 text-amber-800 ring-amber-200"
                }`}
              >
                {profile.emailVerified ? "Đã xác nhận" : "Chưa xác nhận"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Nhân viên được mời bằng email cần nhập mã OTP gửi tới {profile.emailMasked} trước khi
              đổi thông tin nhạy cảm. Tài khoản Google đã xác minh email thì được tính đã xác nhận.
            </p>
            {profile.emailVerified ? (
              <p className="mt-3 text-sm text-emerald-800">Email hồ sơ đã được xác nhận.</p>
            ) : verifyStep === "otp" ? (
              <form action={verifyConfirmAction} className="mt-4 space-y-4">
                <p className="text-sm text-slate-600">
                  {verifyRequestState.message ?? `Nhập mã 6 số đã gửi tới ${profile.emailMasked}.`}
                </p>
                <div className="field-group">
                  <label htmlFor="verifyCode" className="label mb-0">
                    Mã xác nhận
                  </label>
                  <input
                    id="verifyCode"
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
                {verifyError ? (
                  <p role="alert" className="alert-error">
                    {verifyError}
                  </p>
                ) : null}
                <button type="submit" disabled={verifyConfirmPending} className="btn-primary">
                  {verifyConfirmPending ? "Đang xác nhận..." : "Xác nhận email"}
                </button>
              </form>
            ) : (
              <form action={verifyRequestAction} className="mt-4 space-y-3">
                {verifyError ? (
                  <p role="alert" className="alert-error">
                    {verifyError}
                  </p>
                ) : null}
                {verifySuccess ? (
                  <p role="status" className="alert-success">
                    {verifySuccess}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={verifyRequestPending || !profile.canSendEmailOtp}
                  className="btn-secondary"
                >
                  {verifyRequestPending ? "Đang gửi mã..." : "Gửi mã OTP xác nhận"}
                </button>
                {!profile.canSendEmailOtp ? (
                  <p className="text-xs text-amber-700">
                    Chưa cấu hình gửi email OTP. Liên hệ quản trị.
                  </p>
                ) : null}
              </form>
            )}
          </section>

          {profile.canLinkGoogle ? (
            <section className="card-padded">
              <h2 className="text-base font-semibold text-slate-900">Liên kết Google</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Chỉ liên kết khi bạn đã đăng nhập. ShopInbox không tự gắn Google vào tài khoản mật
                khẩu khi người khác bấm Đăng nhập/Đăng ký với Google.
              </p>
              {profile.googleOAuthConfigured ? (
                <a
                  href="/api/auth/google/start?mode=link"
                  className="btn-secondary mt-4 inline-flex items-center gap-2"
                >
                  <GoogleIcon />
                  Liên kết Google
                </a>
              ) : (
                <p className="mt-3 text-xs text-amber-700">
                  Google OAuth chưa cấu hình — liên hệ admin.
                </p>
              )}
            </section>
          ) : null}

          <section className="card-padded">
            <h2 className="text-base font-semibold text-slate-900">
              {profile.hasPassword ? "Đổi mật khẩu" : "Thêm mật khẩu đăng nhập"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {profile.hasPassword
                ? "Đổi mật khẩu bắt buộc mã OTP gửi tới email đã che. Sau đó đăng nhập bằng email + mật khẩu."
                : "Tài khoản đang vào bằng Google. Thêm mật khẩu (OTP email) để đăng nhập ngoài, không cần mở Google."}
            </p>
            {passwordStep === "otp" ? (
              <form action={passwordConfirmAction} className="mt-4 space-y-4">
                <p className="text-sm text-slate-600">
                  {passwordRequestState.message ?? `Nhập mã 6 số đã gửi tới ${profile.emailMasked}.`}
                </p>
                <div className="field-group">
                  <label htmlFor="passwordOtp" className="label mb-0">
                    Mã xác minh
                  </label>
                  <input
                    id="passwordOtp"
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
                {passwordError ? (
                  <p role="alert" className="alert-error">
                    {passwordError}
                  </p>
                ) : null}
                <button type="submit" disabled={passwordConfirmPending} className="btn-primary">
                  {passwordConfirmPending
                    ? "Đang lưu..."
                    : profile.hasPassword
                      ? "Xác nhận đổi mật khẩu"
                      : "Xác nhận thêm mật khẩu"}
                </button>
              </form>
            ) : (
              <form action={passwordRequestAction} className="mt-4 space-y-4">
                {profile.hasPassword ? (
                  <div className="field-group">
                    <label htmlFor="currentPassword" className="label mb-0">
                      Mật khẩu hiện tại
                    </label>
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      className="input-field"
                    />
                  </div>
                ) : null}
                <div className="field-group">
                  <label htmlFor="newPassword" className="label mb-0">
                    {profile.hasPassword ? "Mật khẩu mới" : "Mật khẩu"}
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
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
                    minLength={8}
                    required
                    className="input-field"
                  />
                </div>
                {passwordError ? (
                  <p role="alert" className="alert-error">
                    {passwordError}
                  </p>
                ) : null}
                {passwordSuccess ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {passwordSuccess}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={passwordRequestPending || !profile.canSendEmailOtp}
                  className="btn-secondary"
                >
                  {passwordRequestPending ? "Đang gửi mã..." : "Gửi mã OTP"}
                </button>
                {!profile.canSendEmailOtp ? (
                  <p className="text-xs text-amber-700">
                    Chưa cấu hình gửi email OTP. Liên hệ quản trị.
                  </p>
                ) : null}
              </form>
            )}
          </section>
        </div>
      </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
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
