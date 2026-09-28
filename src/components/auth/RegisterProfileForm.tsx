"use client";

import { useActionState } from "react";
import {
  completeRegisterProfileAction,
  type RegisterProfileState,
} from "@/app/register/profile/actions";
import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { maskEmail } from "@/lib/mask-email";

const initial: RegisterProfileState = {};

export function RegisterProfileForm({
  email,
  defaultName,
  defaultPhone,
  avatarUrl,
}: {
  email: string;
  defaultName: string;
  defaultPhone: string;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState(completeRegisterProfileAction, initial);

  return (
    <form action={action} className="mt-6 space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
        <StaffAvatar name={defaultName || maskEmail(email)} avatarUrl={avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{maskEmail(email)}</p>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="avatarUrl" value={avatarUrl ?? ""} />

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
          defaultValue={defaultName}
          className="input-field"
        />
      </div>

      <div className="field-group">
        <label htmlFor="phone" className="label mb-0">
          Số điện thoại
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          defaultValue={defaultPhone}
          className="input-field"
        />
      </div>

      <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary w-full">
        {pending ? "Đang lưu…" : "Lưu và cấu hình cửa hàng"}
      </button>
    </form>
  );
}
