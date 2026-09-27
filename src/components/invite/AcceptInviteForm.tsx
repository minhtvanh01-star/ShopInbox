"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "@/app/invite/[token]/actions";
import { REGISTER_MIN_PASSWORD_LENGTH } from "@/lib/auth-password";
import { maskEmail } from "@/lib/mask-email";

const initial: AcceptInviteState = {};

type AcceptInviteFormProps = {
  token: string;
  shopName: string;
  lockedEmail: string | null;
  roleLabel: string;
};

export function AcceptInviteForm({
  token,
  shopName,
  lockedEmail,
  roleLabel,
}: AcceptInviteFormProps) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);

  return (
    <form action={action} className="mt-6 space-y-5">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      ) : null}
      <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-slate-600">
        Bạn đang vào <strong className="text-slate-800">{shopName}</strong> với vai trò{" "}
        <strong>{roleLabel}</strong>.
      </p>
      <div className="field-group">
        <label htmlFor="name" className="label mb-0">
          Họ tên
        </label>
        <input id="name" name="name" type="text" required maxLength={100} className="input-field" autoComplete="name" />
      </div>
      <div className="field-group">
        <label htmlFor="email" className="label mb-0">
          Email
        </label>
        {lockedEmail ? (
          <>
            <input type="hidden" name="email" value={lockedEmail} />
            <input
              id="email"
              type="text"
              readOnly
              value={maskEmail(lockedEmail)}
              className="input-field bg-surface-muted text-slate-600"
            />
            <p className="mt-1 text-xs text-slate-400">
              Email lời mời đã che. Sau khi vào shop, xác nhận hồ sơ bằng OTP trên trang hồ sơ.
            </p>
          </>
        ) : (
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input-field"
            autoComplete="email"
          />
        )}
      </div>
      <div className="field-group">
        <label htmlFor="password" className="label mb-0">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={REGISTER_MIN_PASSWORD_LENGTH}
          className="input-field"
          autoComplete="new-password"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full" aria-busy={pending}>
        {pending ? "Đang tạo tài khoản…" : "Tham gia shop"}
      </button>
    </form>
  );
}
