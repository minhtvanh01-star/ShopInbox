"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type RegisterActionState } from "@/app/register/actions";

const initialState: RegisterActionState = {};

type RegisterFormProps = {
  shopName: string;
  nextPath: string;
};

export function RegisterForm({ shopName, nextPath }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <>
      <form action={formAction} className="mt-6 space-y-5">
        <input type="hidden" name="next" value={nextPath} />
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
            autoComplete="username"
            required
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
            autoComplete="new-password"
            required
            minLength={8}
            className="input-field"
          />
        </div>
        <div className="field-group">
          <label htmlFor="confirmPassword" className="label mb-0">
            Xác nhận mật khẩu
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input-field"
          />
        </div>
        {state.error ? <p className="alert-error">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Đang tạo tài khoản..." : `Đăng ký ${shopName}`}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Đã có tài khoản?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
