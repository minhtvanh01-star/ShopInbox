"use client";

import { useActionState } from "react";
import {
  createStaffAction,
  type StaffActionState,
} from "@/app/(app)/staff/actions";
import { STAFF_ROLE_LABEL } from "@/lib/labels";
import type { StaffRole } from "@/lib/types";

const initialState: StaffActionState = {};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  createdAt: string;
};

const ROLE_BADGE: Record<StaffRole, string> = {
  owner: "bg-teal-50 text-teal-700 ring-teal-200",
  staff: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StaffManager({ members }: { members: StaffMember[] }) {
  const [state, formAction, pending] = useActionState(createStaffAction, initialState);

  return (
    <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="card-padded">
        <h2 className="text-base font-semibold text-slate-900">Danh sách tài khoản</h2>
        <p className="mt-1 text-sm text-slate-500">Mật khẩu lưu dạng bcrypt hash trong DB.</p>
        <ul className="mt-5 divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex items-start justify-between gap-3 py-4 first:pt-0">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{member.name}</p>
                <p className="truncate text-sm text-slate-500">{member.email}</p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${ROLE_BADGE[member.role]}`}
                >
                  {STAFF_ROLE_LABEL[member.role]}
                </span>
                <p className="mt-1 text-[11px] text-slate-400">{member.createdAt}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-padded">
        <h2 className="text-base font-semibold text-slate-900">Thêm nhân viên</h2>
        <p className="mt-1 text-sm text-slate-500">Chỉ chủ shop (admin) mới thêm được.</p>
        <form action={formAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="name" className="label">
              Tên
            </label>
            <input id="name" name="name" required className="input-field-sm" />
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email đăng nhập
            </label>
            <input id="email" name="email" type="email" required className="input-field-sm" />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Mật khẩu tạm
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="input-field-sm"
            />
          </div>
          <div>
            <label htmlFor="role" className="label">
              Vai trò
            </label>
            <select id="role" name="role" defaultValue="staff" className="input-field-sm">
              <option value="staff">Nhân viên</option>
              <option value="owner">Chủ shop (admin)</option>
            </select>
          </div>
          {state.error ? <p className="alert-error">{state.error}</p> : null}
          {state.success ? <p className="alert-success">{state.success}</p> : null}
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Đang thêm..." : "Thêm tài khoản"}
          </button>
        </form>
      </section>
    </div>
  );
}
