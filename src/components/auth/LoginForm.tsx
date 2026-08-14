"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/app/login/actions";

const initialState: AuthActionState = {};

type LoginFormProps = {
  shopName: string;
  nextPath: string;
};

export function LoginForm({ shopName, nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <div className="field-group">
        <label htmlFor="email" className="label mb-0">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue="admin@lily.vn"
          className="input-field"
        />
      </div>
      <div className="field-group">
        <label htmlFor="password" className="label mb-0">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input-field"
        />
      </div>
      {state.error ? <p className="alert-error">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Đang đăng nhập..." : `Đăng nhập ${shopName}`}
      </button>
      <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-xs leading-5 text-slate-500">
        <p className="font-medium text-slate-600">Tài khoản demo</p>
        <p className="mt-1">
          Admin: <code className="rounded bg-white px-1 text-slate-700">admin@lily.vn</code> /{" "}
          <code className="rounded bg-white px-1 text-slate-700">Admin@123</code>
        </p>
        <p className="mt-1">
          Nhân viên: <code className="rounded bg-white px-1 text-slate-700">nhanvien@lily.vn</code>{" "}
          / <code className="rounded bg-white px-1 text-slate-700">Staff@123</code>
        </p>
      </div>
    </form>
  );
}
