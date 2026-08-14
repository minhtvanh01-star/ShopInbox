"use client";

import { useActionState } from "react";
import {
  createStaffAction,
  type AuthActionState,
} from "@/app/login/actions";
import { STAFF_ROLE_LABEL } from "@/lib/labels";
import type { StaffRole } from "@/lib/types";

const initialState: AuthActionState = {};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  createdAt: string;
};

export function StaffManager({ members }: { members: StaffMember[] }) {
  const [state, formAction, pending] = useActionState(createStaffAction, initialState);

  return (
    <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Danh sách tài khoản</h2>
        <p className="mt-1 text-sm text-slate-500">Mật khẩu lưu dạng bcrypt hash trong DB.</p>
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map((member) => (
            <li key={member.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-900">{member.name}</p>
                <p className="text-sm text-slate-500">{member.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-teal-700">
                  {STAFF_ROLE_LABEL[member.role]}
                </p>
                <p className="text-[11px] text-slate-400">{member.createdAt}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Thêm nhân viên</h2>
        <p className="mt-1 text-sm text-slate-500">Chỉ chủ shop (admin) mới thêm được.</p>
        <form action={formAction} className="mt-4 space-y-3">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
              Tên
            </label>
            <input
              id="name"
              name="name"
              required
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email đăng nhập
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Mật khẩu tạm
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
              Vai trò
            </label>
            <select
              id="role"
              name="role"
              defaultValue="staff"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
            >
              <option value="staff">Nhân viên</option>
              <option value="owner">Chủ shop (admin)</option>
            </select>
          </div>
          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? "Đang thêm..." : "Thêm tài khoản"}
          </button>
        </form>
      </section>
    </div>
  );
}
