"use client";



import { useActionState, useState } from "react";

import {

  createStaffAction,

  resetStaffPasswordAction,

  updateStaffAction,

  type StaffActionState,

} from "@/app/(app)/staff/actions";

import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { DEFAULT_ROLE_CODE, roleBadgeClass, roleLabel } from "@/lib/rbac-catalog";
import { maskEmail } from "@/lib/mask-email";
import { DEFAULT_MAX_USERS_PER_SHOP } from "@/lib/shop-policy";



const createInitial: StaffActionState = {};

const updateInitial: StaffActionState = {};

const resetInitial: StaffActionState = {};



type StaffMember = {

  id: string;

  name: string;

  email: string;

  avatarUrl: string | null;

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

  maxUsersPerShop = DEFAULT_MAX_USERS_PER_SHOP,

}: {

  members: StaffMember[];

  roles: RoleOption[];

  canManage: boolean;

  maxUsersPerShop?: number;

}) {

  const [createState, createAction, createPending] = useActionState(

    createStaffAction,

    createInitial,

  );

  const [updateState, updateAction, updatePending] = useActionState(

    updateStaffAction,

    updateInitial,

  );

  const [resetState, resetAction, resetPending] = useActionState(

    resetStaffPasswordAction,

    resetInitial,

  );

  const [editingId, setEditingId] = useState<string | null>(null);



  const editing = members.find((item) => item.id === editingId) ?? null;

  const pendingMembers = members.filter((member) => !member.isActive);

  const activeCount = members.filter((member) => member.isActive).length;

  const seatsFull = activeCount >= maxUsersPerShop;

  const sortedMembers = [...members].sort((a, b) => {

    if (a.isActive === b.isActive) return 0;

    return a.isActive ? 1 : -1;

  });



  return (

    <div className="grid min-h-0 flex-1 gap-6 overflow-auto bg-[linear-gradient(180deg,#f0fdfa_0%,#e8f1f4_100%)] p-6 lg:grid-cols-[1.1fr_0.9fr]">

      <section className="card-padded">

        <div className="flex flex-wrap items-start justify-between gap-3">

          <div>

            <h2 className="text-base font-semibold tracking-tight text-teal-950">

              Danh sách tài khoản

            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">

              Tài khoản đăng ký mới hoặc Google ở trạng thái chờ phê duyệt. Bật hoạt động và chọn vai

              trò để họ đăng nhập được.

            </p>

          </div>

          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200">

            {activeCount}/{maxUsersPerShop} đang hoạt động · {members.length} tổng

          </span>

        </div>

        {pendingMembers.length > 0 ? (

          <p

            role="status"

            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"

          >

            {pendingMembers.length} tài khoản đang chờ phê duyệt / phân quyền.

          </p>

        ) : null}

        <ul className="mt-5 divide-y divide-border">

          {sortedMembers.map((member) => (

            <li

              key={member.id}

              className={`flex items-start justify-between gap-3 py-4 first:pt-0 ${

                editingId === member.id ? "rounded-xl bg-accent-muted/70 px-3 -mx-1" : ""

              }`}

            >

              <div className="flex min-w-0 items-start gap-3">

                <StaffAvatar name={member.name} avatarUrl={member.avatarUrl} />

                <div className="min-w-0">

                  <p className="font-medium text-slate-900">

                    {member.name}

                    {!member.isActive ? (

                      <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">

                        chờ phê duyệt

                      </span>

                    ) : null}

                  </p>

                  <p className="truncate text-sm text-slate-500">{maskEmail(member.email)}</p>

                </div>

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

                    className="mt-2 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-900 hover:underline"

                  >

                    {!member.isActive ? "Phê duyệt / phân quyền" : "Sửa"}

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

            <section className="card-padded border-teal-200/80 bg-[linear-gradient(165deg,#ffffff_0%,#f0fdfa_100%)]">

              <div className="flex items-start justify-between gap-3">

                <div>

                  <h2 className="text-base font-semibold tracking-tight text-teal-950">

                    {editing.isActive ? "Sửa nhân viên" : "Phê duyệt / phân quyền"}

                  </h2>

                  <p className="mt-1 text-sm text-slate-500">{maskEmail(editing.email)}</p>

                  {!editing.isActive ? (

                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">

                      Chọn vai trò rồi đặt trạng thái &quot;Đang hoạt động&quot; để cho phép đăng

                      nhập.

                    </p>

                  ) : null}

                </div>

                <button

                  type="button"

                  onClick={() => setEditingId(null)}

                  className="icon-btn"

                  aria-label="Đóng form sửa"

                >

                  ✕

                </button>

              </div>

              <form key={editing.id} action={updateAction} className="mt-5 space-y-4">

                <input type="hidden" name="staffId" value={editing.id} />

                <div className="field-group">

                  <label htmlFor="edit-name" className="label mb-0">

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

                <div className="field-group">

                  <label htmlFor="edit-role" className="label mb-0">

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

                <div className="field-group">

                  <label htmlFor="edit-active" className="label mb-0">

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

                {updateState.error ? (

                  <p role="alert" className="alert-error">

                    {updateState.error}

                  </p>

                ) : null}

                {updateState.success ? (

                  <p role="status" className="alert-success">

                    {updateState.success}

                  </p>

                ) : null}

                <button type="submit" disabled={updatePending} className="btn-primary">

                  {updatePending

                    ? "Đang lưu..."

                    : editing.isActive

                      ? "Lưu thay đổi"

                      : "Phê duyệt và lưu"}

                </button>

              </form>

              <form action={resetAction} className="mt-6 space-y-4 border-t border-border pt-5">

                <input type="hidden" name="staffId" value={editing.id} />

                <h3 className="text-sm font-semibold text-teal-950">Đặt lại mật khẩu</h3>

                <p className="text-sm text-slate-500">

                  Dùng khi nhân viên quên mật khẩu. Tài khoản Google cũng có thể đăng nhập email sau khi đặt.

                </p>

                <div className="field-group">

                  <label htmlFor="reset-password" className="label mb-0">

                    Mật khẩu mới

                  </label>

                  <input

                    id="reset-password"

                    name="password"

                    type="password"

                    required

                    minLength={8}

                    autoComplete="new-password"

                    className="input-field-sm"

                  />

                </div>

                <div className="field-group">

                  <label htmlFor="reset-password-confirm" className="label mb-0">

                    Xác nhận mật khẩu

                  </label>

                  <input

                    id="reset-password-confirm"

                    name="confirmPassword"

                    type="password"

                    required

                    minLength={8}

                    autoComplete="new-password"

                    className="input-field-sm"

                  />

                </div>

                {resetState.error ? (

                  <p role="alert" className="alert-error">

                    {resetState.error}

                  </p>

                ) : null}

                {resetState.success ? (

                  <p role="status" className="alert-success">

                    {resetState.success}

                  </p>

                ) : null}

                <button type="submit" disabled={resetPending} className="btn-ghost">

                  {resetPending ? "Đang đặt lại..." : "Đặt mật khẩu mới"}

                </button>

              </form>

            </section>

          ) : null}



          <section className="card-padded">

            <h2 className="text-base font-semibold tracking-tight text-teal-950">Thêm nhân viên</h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">

              Chọn vai trò từ danh sách đang bật trong cấu hình. Tối đa {maxUsersPerShop} thành
              viên đang hoạt động / shop.

            </p>

            {seatsFull ? (

              <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">

                Đã đủ {maxUsersPerShop} thành viên đang hoạt động. Vô hiệu hóa một tài khoản
                trước khi thêm mới.

              </p>

            ) : null}

            <form action={createAction} className="mt-5 space-y-4">

              <div className="field-group">

                <label htmlFor="name" className="label mb-0">

                  Tên

                </label>

                <input id="name" name="name" required className="input-field-sm" />

              </div>

              <div className="field-group">

                <label htmlFor="email" className="label mb-0">

                  Email đăng nhập

                </label>

                <input id="email" name="email" type="email" required className="input-field-sm" />

              </div>

              <div className="field-group">

                <label htmlFor="password" className="label mb-0">

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

              <div className="field-group">

                <label htmlFor="role" className="label mb-0">

                  Vai trò

                </label>

                <select

                  id="role"

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

                <p role="alert" className="alert-error">

                  {createState.error}

                </p>

              ) : null}

              {createState.success ? (

                <p role="status" className="alert-success">

                  {createState.success}

                </p>

              ) : null}

              <button type="submit" disabled={createPending || seatsFull} className="btn-primary">

                {createPending ? "Đang thêm..." : seatsFull ? "Đã đủ ghế" : "Thêm tài khoản"}

              </button>

            </form>

          </section>

        </div>

      ) : (

        <section className="card-padded">

          <h2 className="text-base font-semibold tracking-tight text-teal-950">Quản lý nhân viên</h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">

            Bạn chỉ được xem danh sách, không thêm/sửa tài khoản.

          </p>

        </section>

      )}

    </div>

  );

}


