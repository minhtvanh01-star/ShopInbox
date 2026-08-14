"use client";

import { useActionState, useState } from "react";
import {
  createStaffAction,
  updateStaffAction,
  type StaffActionState,
} from "@/app/(app)/staff/actions";
import { DEFAULT_ROLE_CODE, roleBadgeClass, roleLabel } from "@/lib/rbac-catalog";

const createInitial: StaffActionState = {};
const updateInitial: StaffActionState = {};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
};

type RoleOption = {
  code: string;
  name: string;
};

export function StaffManager({
  members,
  roles,
  canManage,
}: {
  members: StaffMember[];
  roles: RoleOption[];
  canManage: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createStaffAction,
    createInitial,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateStaffAction,
    updateInitial,
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = members.find((item) => item.id === editingId) ?? null;

  return (
    <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="card-padded">
        <h2 className="text-base font-semibold text-slate-900">Danh sách tài khoản</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mật khẩu lưu dạng bcrypt hash. Tài khoản tắt không đăng nhập được.
        </p>
        <ul className="mt-5 divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex items-start justify-between gap-3 py-4 first:pt-0">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {member.name}
                  {!member.isActive ? (
                    <span className="ml-2 text-xs font-semibold text-amber-700">(đã tắt)</span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-slate-500">{member.email}</p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${roleBadgeClass(member.role)}`}
                >
                  {member.roleName || roleLabel(member.role)}
                </span>
                <p className="mt-1 text-[11px] text-slate-400">{member.createdAt}</p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setEditingId(member.id)}
                    className="mt-2 text-xs font-medium text-teal-700 hover:underline"
                  >
                    Sửa
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canManage ? (
        <div className="space-y-6">
          {editing ? (
            <section className="card-padded">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Sửa nhân viên</h2>
                  <p className="mt-1 text-sm text-slate-500">{editing.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-xs font-medium text-slate-500 hover:underline"
                >
                  Đóng
                </button>
              </div>
              <form key={editing.id} action={updateAction} className="mt-5 space-y-4">
                <input type="hidden" name="staffId" value={editing.id} />
                <div>
                  <label htmlFor="edit-name" className="label">
                    Tên
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    required
                    defaultValue={editing.name}
                    className="input-field-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-role" className="label">
                    Vai trò
                  </label>
                  <select
                    id="edit-role"
                    name="role"
                    defaultValue={editing.role}
                    className="input-field-sm"
                  >
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-active" className="label">
                    Trạng thái
                  </label>
                  <select
                    id="edit-active"
                    name="isActive"
                    defaultValue={editing.isActive ? "true" : "false"}
                    className="input-field-sm"
                  >
                    <option value="true">Đang hoạt động</option>
                    <option value="false">Đã tắt</option>
                  </select>
                </div>
                {updateState.error ? <p className="alert-error">{updateState.error}</p> : null}
                {updateState.success ? (
                  <p className="alert-success">{updateState.success}</p>
                ) : null}
                <button type="submit" disabled={updatePending} className="btn-primary">
                  {updatePending ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </form>
            </section>
          ) : null}

          <section className="card-padded">
            <h2 className="text-base font-semibold text-slate-900">Thêm nhân viên</h2>
            <p className="mt-1 text-sm text-slate-500">
              Chọn vai trò từ danh sách đang bật trong cấu hình.
            </p>
            <form action={createAction} className="mt-5 space-y-4">
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
                <select id="role" name="role" defaultValue={DEFAULT_ROLE_CODE} className="input-field-sm">
                  {roles.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              {createState.error ? <p className="alert-error">{createState.error}</p> : null}
              {createState.success ? (
                <p className="alert-success">{createState.success}</p>
              ) : null}
              <button type="submit" disabled={createPending} className="btn-primary">
                {createPending ? "Đang thêm..." : "Thêm tài khoản"}
              </button>
            </form>
          </section>
        </div>
      ) : (
        <section className="card-padded">
          <h2 className="text-base font-semibold text-slate-900">Quản lý nhân viên</h2>
          <p className="mt-1 text-sm text-slate-500">
            Bạn chỉ được xem danh sách, không thêm/sửa tài khoản.
          </p>
        </section>
      )}
    </div>
  );
}
