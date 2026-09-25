"use client";

import Link from "next/link";
import { formatMoney, ORDER_STATUS_LABEL } from "@/lib/labels";
import type { OrderSummaryBucket, OrderSummaryView } from "@/lib/order-summary";
import type { OrderStatus } from "@/lib/types";

const VIEWS: OrderSummaryView[] = ["day", "month", "year"];
const STATUS_OPTIONS: Array<OrderStatus | ""> = [
  "",
  "new",
  "confirmed",
  "shipping",
  "done",
  "cancelled",
];

export function OrderSummaryWorkspace({
  view,
  buckets,
  totals,
  filters,
}: {
  view: OrderSummaryView;
  buckets: OrderSummaryBucket[];
  totals: {
    orderCount: number;
    revenue: number;
    cancelledCount: number;
    cancelledAmount: number;
  };
  filters: { from: string; to: string; status: string };
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Tổng hợp đơn hàng</h1>
          <p className="page-subtitle">
            Doanh thu theo ngày / tháng / năm (giờ VN). Đơn hủy tách riêng, không cộng vào doanh thu.
          </p>
        </div>
        <Link href="/orders" className="btn-secondary min-h-11">
          ← Danh sách
        </Link>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-6 py-4"
      >
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((item) => (
            <label key={item} className="cursor-pointer">
              <input
                type="radio"
                name="view"
                value={item}
                defaultChecked={view === item}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-semibold text-slate-600 peer-checked:border-teal-600 peer-checked:bg-teal-50 peer-checked:text-teal-800">
                {item === "day" ? "Ngày" : item === "month" ? "Tháng" : "Năm"}
              </span>
            </label>
          ))}
        </div>
        <label className="text-xs">
          <span className="label">Từ ngày</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="input-field-sm min-h-11"
          />
        </label>
        <label className="text-xs">
          <span className="label">Đến ngày</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="input-field-sm min-h-11"
          />
        </label>
        <label className="text-xs">
          <span className="label">Trạng thái</span>
          <select name="status" defaultValue={filters.status} className="input-field-sm min-h-11">
            {STATUS_OPTIONS.map((value) => (
              <option key={value || "all"} value={value}>
                {value ? ORDER_STATUS_LABEL[value] : "Tất cả"}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary-sm min-h-11">
          Áp dụng
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-padded">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Số đơn</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.orderCount}</p>
          </div>
          <div className="card-padded">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Doanh thu (không hủy)
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatMoney(totals.revenue)}
            </p>
          </div>
          <div className="card-padded">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Đơn hủy</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.cancelledCount}</p>
          </div>
          <div className="card-padded">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Giá trị hủy
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatMoney(totals.cancelledAmount)}
            </p>
          </div>
        </div>

        {buckets.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium text-slate-700">Chưa có đơn trong khoảng lọc</p>
          </div>
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Kỳ</th>
                  <th className="px-4 py-3.5 font-semibold">Số đơn</th>
                  <th className="px-4 py-3.5 font-semibold">Doanh thu</th>
                  <th className="px-4 py-3.5 font-semibold">Hủy</th>
                  <th className="px-4 py-3.5 font-semibold">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket, index) => (
                  <tr
                    key={bucket.key}
                    className={`border-t border-border ${
                      index % 2 === 1 ? "bg-surface-muted/50" : "bg-surface"
                    }`}
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {view === "day" && bucket.from ? (
                        <Link
                          href={`/orders?from=${bucket.from}&to=${bucket.to ?? bucket.from}`}
                          className="text-teal-800 underline-offset-2 hover:underline"
                        >
                          {bucket.label}
                        </Link>
                      ) : (
                        bucket.label
                      )}
                    </td>
                    <td className="px-4 py-3.5">{bucket.orderCount}</td>
                    <td className="px-4 py-3.5 font-medium">{formatMoney(bucket.revenue)}</td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {bucket.cancelledCount}
                      {bucket.cancelledCount > 0
                        ? ` (${formatMoney(bucket.cancelledAmount)})`
                        : ""}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {(["new", "confirmed", "shipping", "done", "cancelled"] as const)
                        .filter((s) => bucket.byStatus[s] > 0)
                        .map((s) => `${ORDER_STATUS_LABEL[s]} ${bucket.byStatus[s]}`)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
