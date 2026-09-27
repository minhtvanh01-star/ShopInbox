"use client";

import { useActionState, useState } from "react";
import {
  createStaffInviteAction,
  revokeStaffInviteAction,
  type InviteActionState,
} from "@/app/(app)/staff/actions";
import { DEFAULT_ROLE_CODE, roleLabel } from "@/lib/rbac-catalog";
import { maskEmail } from "@/lib/mask-email";

const createInitial: InviteActionState = {};
const revokeInitial: InviteActionState = {};

type OpenInvite = {
  id: string;
  email: string | null;
  roleCode: string;
  expiresAt: string;
};

export function StaffInvitePanel({
  invites,
  roles,
}: {
  invites: OpenInvite[];
  roles: { code: string; name: string }[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createStaffInviteAction,
    createInitial,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeStaffInviteAction,
    revokeInitial,
  );
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!createState.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(createState.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card-padded">
      <h2 className="text-base font-semibold tracking-tight text-teal-950">Mời vào shop này</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Nhân viên không đăng ký công khai. Gửi link — họ tạo tài khoản và được gắn đúng cửa hàng
        của bạn.
      </p>

      <form action={createAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="field-group">
          <label htmlFor="invite-email" className="label mb-0">
            Email (tuỳ chọn)
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            className="input-field-sm"
            placeholder="Để trống nếu gửi link chung"
          />
        </div>
        <div className="field-group">
          <label htmlFor="invite-role" className="label mb-0">
            Vai trò
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue={DEFAULT_ROLE_CODE}
            className="input-field-sm"
          >
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        {createState.error ? (
          <p role="alert" className="alert-error sm:col-span-2">
            {createState.error}
          </p>
        ) : null}
        {createState.success ? (
          <p role="status" className="alert-success sm:col-span-2">
            {createState.success}
          </p>
        ) : null}
        {createState.inviteUrl ? (
          <div className="sm:col-span-2 rounded-lg border border-teal-200 bg-teal-50/70 px-3 py-2">
            <p className="break-all text-xs text-teal-950">{createState.inviteUrl}</p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="mt-2 text-xs font-semibold text-teal-800 hover:underline"
            >
              {copied ? "Đã sao chép" : "Sao chép link"}
            </button>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={createPending} className="btn-primary-sm" aria-busy={createPending}>
            {createPending ? "Đang tạo…" : "Tạo link mời"}
          </button>
        </div>
      </form>

      {revokeState.error ? (
        <p role="alert" className="alert-error mt-3">
          {revokeState.error}
        </p>
      ) : null}
      {revokeState.success ? (
        <p role="status" className="alert-success mt-3">
          {revokeState.success}
        </p>
      ) : null}

      {invites.length > 0 ? (
        <ul className="mt-5 divide-y divide-border">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {invite.email ? maskEmail(invite.email) : "Link chung"}
                </p>
                <p className="text-xs text-slate-500">
                  {roleLabel(invite.roleCode)} · hết hạn {invite.expiresAt}
                </p>
              </div>
              <form action={revokeAction}>
                <input type="hidden" name="inviteId" value={invite.id} />
                <button
                  type="submit"
                  disabled={revokePending}
                  className="text-xs font-semibold text-rose-700 hover:underline"
                >
                  Thu hồi
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
