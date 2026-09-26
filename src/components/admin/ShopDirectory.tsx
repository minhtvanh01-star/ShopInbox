"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  toggleShopSuspendedAction,
  type PlatformShopActionState,
} from "@/app/(app)/admin/shops/actions";
import {
  SHOP_PLAN_LABEL,
  SHOP_PLANS,
  SHOP_SUPPORT_STATUS_LABEL,
  SHOP_SUPPORT_STATUSES,
  type ShopPlanCode,
  type ShopSupportStatusCode,
} from "@/lib/shop-ops";

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
  planCode: ShopPlanCode;
  supportStatus: ShopSupportStatusCode;
};

function statusLabel(shop: ShopDirectoryRow) {
  if (shop.suspended) return "Tạm khóa";
  if (!shop.setupDone) return "Chưa setup";
  return "Đang chạy";
}

function statusClass(shop: ShopDirectoryRow) {
  if (shop.suspended) {
    return "bg-rose-50 text-rose-800 ring-rose-200";
  }
  if (!shop.setupDone) {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-emerald-50 text-emerald-800 ring-emerald-200";
}

function supportClass(status: ShopSupportStatusCode) {
  if (status === "needs_help") return "bg-rose-50 text-rose-800 ring-rose-200";
  if (status === "in_progress") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "watching") return "bg-sky-50 text-sky-800 ring-sky-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

export function ShopDirectory({ shops }: { shops: ShopDirectoryRow[] }) {
  const [state, action, pending] = useActionState(toggleShopSuspendedAction, initial);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [support, setSupport] = useState("all");

  const stats = useMemo(() => {
    const users = shops.reduce((sum, shop) => sum + shop.staffCount, 0);
    return {
      shops: shops.length,
      users,
      help: shops.filter((shop) => shop.supportStatus === "needs_help").length,
      locked: shops.filter((shop) => shop.suspended).length,
    };
  }, [shops]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return shops.filter((shop) => {
      if (plan !== "all" && shop.planCode !== plan) return false;
      if (support !== "all" && shop.supportStatus !== support) return false;
      if (!needle) return true;
      const haystack = [shop.name, shop.ownerName, shop.ownerEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [shops, query, plan, support]);

  const hasFilter = query.trim() !== "" || plan !== "all" || support !== "all";

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

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cửa hàng" value={stats.shops} />
        <StatCard label="Người dùng" value={stats.users} />
        <StatCard label="Cần hỗ trợ" value={stats.help} tone={stats.help > 0 ? "warn" : undefined} />
        <StatCard label="Tạm khóa" value={stats.locked} tone={stats.locked > 0 ? "danger" : undefined} />
      </section>

      <section className="card-padded overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-4 md:flex-row md:items-end">
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Tìm shop hoặc chủ shop</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên shop, tên hoặc email chủ shop"
              className="input-field-sm min-h-11"
            />
          </label>
          <label className="w-full text-sm md:w-44">
            <span className="mb-1 block font-medium text-slate-700">Gói</span>
            <select
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              className="input-field-sm min-h-11"
            >
              <option value="all">Tất cả gói</option>
              {SHOP_PLANS.map((code) => (
                <option key={code} value={code}>
                  {SHOP_PLAN_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="w-full text-sm md:w-48">
            <span className="mb-1 block font-medium text-slate-700">Hỗ trợ</span>
            <select
              value={support}
              onChange={(event) => setSupport(event.target.value)}
              className="input-field-sm min-h-11"
            >
              <option value="all">Tất cả trạng thái</option>
              {SHOP_SUPPORT_STATUSES.map((code) => (
                <option key={code} value={code}>
                  {SHOP_SUPPORT_STATUS_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Cửa hàng</th>
                <th className="px-4 py-3 font-semibold">Chủ shop / người dùng</th>
                <th className="px-4 py-3 font-semibold">Gói</th>
                <th className="px-4 py-3 font-semibold">Hỗ trợ</th>
                <th className="px-4 py-3 font-semibold">Nhân viên</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {shops.length === 0
                      ? "Chưa có shop nào trên hệ thống."
                      : "Không có shop khớp bộ lọc. Thử xóa tìm kiếm hoặc chọn lại gói / hỗ trợ."}
                    {hasFilter && shops.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setPlan("all");
                          setSupport("all");
                        }}
                        className="mt-3 block w-full cursor-pointer text-sm font-semibold text-teal-800 hover:underline"
                      >
                        Xóa bộ lọc
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                filtered.map((shop) => (
                  <tr key={shop.id} className="bg-surface">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/shops/${shop.id}`}
                        className="font-medium text-teal-800 hover:underline"
                      >
                        <span className="block max-w-[16rem] truncate">{shop.name}</span>
                      </Link>
                      <p className="text-[11px] text-slate-400">{shop.createdAt}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[14rem] truncate text-slate-800">{shop.ownerName ?? "—"}</p>
                      <p className="max-w-[14rem] truncate text-xs text-slate-500">
                        {shop.ownerEmail ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="inline-flex whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200">
                        {SHOP_PLAN_LABEL[shop.planCode]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${supportClass(shop.supportStatus)}`}
                      >
                        {SHOP_SUPPORT_STATUS_LABEL[shop.supportStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{shop.staffCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusClass(shop)}`}
                      >
                        {statusLabel(shop)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <Link
                          href={`/admin/shops/${shop.id}`}
                          className="text-xs font-semibold text-teal-800 hover:underline"
                        >
                          Chi tiết
                        </Link>
                        <form action={action}>
                          <input type="hidden" name="shopId" value={shop.id} />
                          <input type="hidden" name="suspend" value={shop.suspended ? "0" : "1"} />
                          <button
                            type="submit"
                            disabled={pending}
                            className="min-h-10 cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline disabled:cursor-not-allowed"
                          >
                            {shop.suspended ? "Mở lại" : "Tạm khóa"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "danger";
}) {
  const valueClass =
    tone === "danger" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-teal-950";
  return (
    <div className="card-padded">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}
