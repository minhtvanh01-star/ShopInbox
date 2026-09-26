"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  toggleShopSuspendedAction,
  type PlatformShopActionState,
} from "@/app/(app)/admin/shops/actions";

const initial: PlatformShopActionState = {};

export type ShopDirectoryRow = {
  id: string;
  name: string;
  createdAt: string;
  setupDone: boolean;
  suspended: boolean;
  staffCount: number;
  channelCount: number;
  orderCount: number;
  ownerName: string | null;
  ownerEmail: string | null;
  planLabel: string;
  supportLabel: string;
};

export function ShopDirectory({ shops }: { shops: ShopDirectoryRow[] }) {
  const [state, action, pending] = useActionState(toggleShopSuspendedAction, initial);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[linear-gradient(180deg,#f0fdfa_0%,#e8f1f4_100%)] p-6">
      {state.error ? (
        <p role="alert" className="alert-error mb-4">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="alert-success mb-4">
          {state.success}
        </p>
      ) : null}

      <section className="card-padded overflow-hidden p-0">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Cửa hàng</th>
              <th className="px-4 py-3 font-semibold">Chủ shop</th>
              <th className="px-4 py-3 font-semibold">Gói</th>
              <th className="px-4 py-3 font-semibold">Hỗ trợ</th>
              <th className="px-4 py-3 font-semibold">Nhân viên</th>
              <th className="px-4 py-3 font-semibold">Kênh / Đơn</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shops.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  Chưa có shop nào.
                </td>
              </tr>
            ) : (
              shops.map((shop) => (
                <tr key={shop.id} className="bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/shops/${shop.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {shop.name}
                    </Link>
                    <p className="text-[11px] text-slate-400">{shop.createdAt}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{shop.ownerName ?? "—"}</p>
                    <p className="text-xs text-slate-500">{shop.ownerEmail ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{shop.planLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{shop.supportLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{shop.staffCount}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {shop.channelCount} / {shop.orderCount}
                  </td>
                  <td className="px-4 py-3">
                    {shop.suspended ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200">
                        Tạm khóa
                      </span>
                    ) : shop.setupDone ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        Đang chạy
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                        Chưa setup
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={action}>
                      <input type="hidden" name="shopId" value={shop.id} />
                      <input type="hidden" name="suspend" value={shop.suspended ? "0" : "1"} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="text-xs font-semibold text-teal-800 hover:underline"
                      >
                        {shop.suspended ? "Mở lại" : "Tạm khóa"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
