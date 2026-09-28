"use client";

import { useActionState } from "react";
import {
  updateShopPolicyAction,
  type UpdateShopPolicyState,
} from "@/app/(app)/settings/actions";
import {
  MAX_USERS_PER_SHOP_MAX,
  MAX_USERS_PER_SHOP_MIN,
  REPLY_CLAIM_TTL_MAX,
  REPLY_CLAIM_TTL_MIN,
} from "@/lib/shop-policy";
import { SHOP_NAME_MAX } from "@/lib/shop-name";
import { trialPlanSeatWarning } from "@/lib/shop-seats";

type ShopPolicyFormProps = {
  shopName: string;
  replyClaimTtlMinutes: number;
  maxUsersPerShop: number;
};

const initial: UpdateShopPolicyState = {};

export function ShopPolicyForm({
  shopName,
  replyClaimTtlMinutes,
  maxUsersPerShop,
}: ShopPolicyFormProps) {
  const [state, action, pending] = useActionState(updateShopPolicyAction, initial);
  const claimValue = state.replyClaimTtlMinutes ?? replyClaimTtlMinutes;
  const seatsValue = state.maxUsersPerShop ?? maxUsersPerShop;
  const nameValue = state.shopName ?? shopName;

  return (
    <section className="card-padded">
      <h2 className="text-sm font-semibold text-slate-900">Cấu hình cửa hàng</h2>
      <p className="mt-1 text-xs text-slate-500">
        Chỉ Admin mới đổi được.
      </p>
      <p
        role="status"
        className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950"
      >
        {trialPlanSeatWarning()}
      </p>

      <form
        action={action}
        key={`${nameValue}-${claimValue}-${seatsValue}`}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <div className="field-group sm:col-span-2">
          <label htmlFor="shopName" className="label">
            Tên cửa hàng
          </label>
          <input
            id="shopName"
            name="shopName"
            type="text"
            required
            minLength={2}
            maxLength={SHOP_NAME_MAX}
            defaultValue={nameValue}
            className="input-field-sm"
          />
        </div>
        <div className="field-group">
          <label htmlFor="replyClaimTtlMinutes" className="label">
            Thời gian nhả hội thoại (phút)
          </label>
          <input
            id="replyClaimTtlMinutes"
            name="replyClaimTtlMinutes"
            type="number"
            min={REPLY_CLAIM_TTL_MIN}
            max={REPLY_CLAIM_TTL_MAX}
            required
            defaultValue={claimValue}
            className="input-field-sm"
          />
          <p className="text-[11px] text-slate-400">
            Nhân viên không hoạt động sau {REPLY_CLAIM_TTL_MIN}–{REPLY_CLAIM_TTL_MAX} phút sẽ bị
            nhả claim.
          </p>
        </div>

        <div className="field-group">
          <label htmlFor="maxUsersPerShop" className="label">
            Số thành viên tối đa
          </label>
          <input
            id="maxUsersPerShop"
            name="maxUsersPerShop"
            type="number"
            min={MAX_USERS_PER_SHOP_MIN}
            max={MAX_USERS_PER_SHOP_MAX}
            required
            defaultValue={seatsValue}
            className="input-field-sm"
          />
          <p className="text-[11px] text-slate-400">
            Bản chạy thử: tối đa {MAX_USERS_PER_SHOP_MAX} người đang hoạt động.
          </p>
        </div>

        {state.error ? (
          <p role="alert" className="alert-error sm:col-span-2">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="alert-success sm:col-span-2">
            {state.success}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary-sm" aria-busy={pending}>
            {pending ? "Đang lưu…" : "Lưu cấu hình"}
          </button>
        </div>
      </form>
    </section>
  );
}
