"use client";

import { useActionState } from "react";
import { completeShopSetupAction, type SetupShopState } from "@/app/setup/actions";
import { logoutAction } from "@/app/login/actions";
import {
  DEFAULT_MAX_USERS_PER_SHOP,
  DEFAULT_REPLY_CLAIM_TTL_MINUTES,
  MAX_USERS_PER_SHOP_MAX,
  MAX_USERS_PER_SHOP_MIN,
  REPLY_CLAIM_TTL_MAX,
  REPLY_CLAIM_TTL_MIN,
} from "@/lib/shop-policy";
import { SHOP_NAME_MAX } from "@/lib/shop-name";

const initial: SetupShopState = {};

type SetupShopFormProps = {
  defaultName: string;
  replyClaimTtlMinutes?: number;
  maxUsersPerShop?: number;
};

export function SetupShopForm({
  defaultName,
  replyClaimTtlMinutes = DEFAULT_REPLY_CLAIM_TTL_MINUTES,
  maxUsersPerShop = DEFAULT_MAX_USERS_PER_SHOP,
}: SetupShopFormProps) {
  const [state, action, pending] = useActionState(completeShopSetupAction, initial);

  return (
    <div className="mt-6 space-y-5">
      {state.error ? (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      ) : null}
      <form action={action} className="space-y-5">
        <div className="field-group">
          <label htmlFor="shopName" className="label mb-0">
            Tên cửa hàng
          </label>
          <input
            id="shopName"
            name="shopName"
            type="text"
            required
            minLength={2}
            maxLength={SHOP_NAME_MAX}
            defaultValue={defaultName}
            className="input-field"
            autoComplete="organization"
          />
          <p className="text-xs text-slate-500">Hiện trên sidebar và khi mời nhân viên.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field-group">
            <label htmlFor="replyClaimTtlMinutes" className="label mb-0">
              Nhả hội thoại (phút)
            </label>
            <input
              id="replyClaimTtlMinutes"
              name="replyClaimTtlMinutes"
              type="number"
              min={REPLY_CLAIM_TTL_MIN}
              max={REPLY_CLAIM_TTL_MAX}
              required
              defaultValue={replyClaimTtlMinutes}
              className="input-field"
            />
          </div>
          <div className="field-group">
            <label htmlFor="maxUsersPerShop" className="label mb-0">
              Số thành viên tối đa
            </label>
            <input
              id="maxUsersPerShop"
              name="maxUsersPerShop"
              type="number"
              min={MAX_USERS_PER_SHOP_MIN}
              max={MAX_USERS_PER_SHOP_MAX}
              required
              defaultValue={maxUsersPerShop}
              className="input-field"
            />
          </div>
        </div>
        <button type="submit" disabled={pending} className="btn-primary w-full" aria-busy={pending}>
          {pending ? "Đang lưu…" : "Lưu và tiếp tục kết nối kênh"}
        </button>
      </form>
      <form action={logoutAction}>
        <button type="submit" className="w-full text-center text-sm text-slate-500 hover:underline">
          Đăng xuất
        </button>
      </form>
    </div>
  );
}
