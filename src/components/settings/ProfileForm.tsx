"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  updateProfileAction,
  type ProfileActionState,
} from "@/app/(app)/settings/profile/actions";
import { GOOGLE_AUTH_ERROR_MESSAGES } from "@/lib/google-auth-errors";

const initialState: ProfileActionState = {};

type ProfileFormProps = {
  profile: {
    name: string;
    email: string;
    phone: string;
    avatarUrl: string;
    authMethod: "google" | "email" | "both";
    canChangePassword: boolean;
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
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  const flashMessage = flash?.success
    ? { type: "success" as const, text: AUTH_ERROR_MESSAGES[flash.success] ?? flash.success }
    : flash?.error
      ? { type: "error" as const, text: AUTH_ERROR_MESSAGES[flash.error] ?? flash.error }
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <h1 className="page-title">Hồ sơ cá nhân</h1>
        <p className="page-subtitle">Cập nhật thông tin và phương thức đăng nhập của bạn.</p>
      </header>

      {flashMessage ? (
        <div
          className={`border-b px-6 py-3 text-sm ${
            flashMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section className="card-padded">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Thông tin cơ bản</h2>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200 ring-inset">
              {authBadgeLabel(profile.authMethod)}
            </span>
          </div>

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
              <label htmlFor="email" className="label mb-0">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                readOnly
                value={profile.email}
                className="input-field bg-surface-muted text-slate-500"
              />
              {profile.authMethod === "google" || profile.authMethod === "both" ? (
                <p className="mt-1 text-xs text-slate-400">Email từ Google — không đổi tại đây.</p>
              ) : null}
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

            <div className="field-group">
              <label htmlFor="avatarUrl" className="label mb-0">
                URL ảnh đại diện
              </label>
              <input
                id="avatarUrl"
                name="avatarUrl"
                type="url"
                defaultValue={profile.avatarUrl}
                placeholder="https://..."
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

          {profile.canChangePassword ? (
            <section className="card-padded">
              <h2 className="text-base font-semibold text-slate-900">Đổi mật khẩu</h2>
              <form action={passwordAction} className="mt-4 space-y-4">
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
                <div className="field-group">
                  <label htmlFor="newPassword" className="label mb-0">
                    Mật khẩu mới
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
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
                    minLength={8}
                    className="input-field"
                  />
                </div>
                {passwordState.error ? (
                  <p role="alert" className="alert-error">
                    {passwordState.error}
                  </p>
                ) : null}
                {passwordState.success ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {passwordState.success}
                  </p>
                ) : null}
                <button type="submit" disabled={passwordPending} className="btn-secondary">
                  {passwordPending ? "Đang đổi..." : "Đổi mật khẩu"}
                </button>
              </form>
            </section>
          ) : null}
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
