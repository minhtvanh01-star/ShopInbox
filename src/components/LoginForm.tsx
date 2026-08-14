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
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue="admin@lily.vn"
          className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
        />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Đang đăng nhập..." : `Đăng nhập ${shopName}`}
      </button>
      <p className="text-xs leading-5 text-slate-500">
        Demo admin: <code>admin@lily.vn</code> / <code>Admin@123</code>
        <br />
        Demo nhân viên: <code>nhanvien@lily.vn</code> / <code>Staff@123</code>
      </p>
    </form>
  );
}
