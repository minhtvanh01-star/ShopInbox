"use client";

import { useActionState } from "react";
import {
  abandonShopRegistrationAction,
  type RegisterProfileState,
} from "@/app/register/profile/actions";

const initial: RegisterProfileState = {};

export function AbandonShopRegistrationButton() {
  const [state, action, pending] = useActionState(abandonShopRegistrationAction, initial);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Xóa cửa hàng vừa tạo? Không lấy lại được.")) {
          event.preventDefault();
        }
      }}
    >
      {state.error ? (
        <p role="alert" className="alert-error mb-3">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full text-center text-sm text-slate-500 hover:text-rose-700 hover:underline"
      >
        {pending ? "Đang hủy…" : "Hủy đăng ký cửa hàng"}
      </button>
      <p className="mt-2 text-center text-[11px] leading-5 text-slate-400">
        Ấn nhầm Google? Xóa tài khoản vừa tạo rồi về trang đăng nhập.
      </p>
    </form>
  );
}
