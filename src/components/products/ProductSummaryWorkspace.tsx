"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/labels";

export type ProductSummaryTotals = {
  products: number;
  productSelling: number;
  productOff: number;
  variants: number;
  variantSelling: number;
  variantOff: number;
  groups: number;
};

export type ProductSummaryRow = {
  id: string;
  code: string;
  name: string;
  groupName: string | null;
  selling: boolean;
  variantCount: number;
  variantSelling: number;
  minPrice: number | null;
  maxPrice: number | null;
};

export function ProductSummaryWorkspace({
  totals,
  rows,
  groups,
  filters,
}: {
  totals: ProductSummaryTotals;
  rows: ProductSummaryRow[];
  groups: Array<{ id: string; name: string }>;
  filters: { groupId: string; selling: string };
}) {
  const cards = [
    { label: "Sản phẩm", value: String(totals.products) },
    { label: "Đang bán", value: String(totals.productSelling) },
    { label: "Biến thể", value: String(totals.variants) },
    { label: "Biến thể đang bán", value: String(totals.variantSelling) },
    { label: "Nhóm", value: String(totals.groups) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Tổng hợp sản phẩm</h1>
          <p className="page-subtitle">Số lượng catalog và khoảng giá theo biến thể.</p>
        </div>
        <Link href="/products" className="btn-secondary min-h-11">
          ← Danh sách
        </Link>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-6 py-4"
      >
        <label className="text-xs">
          <span className="label">Nhóm</span>
          <select
            name="groupId"
            defaultValue={filters.groupId}
            className="input-field-sm min-h-11 min-w-[12rem]"
          >
            <option value="all">Tất cả nhóm</option>
            <option value="none">Chưa nhóm</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="label">Trạng thái SP</span>
          <select name="selling" defaultValue={filters.selling} className="input-field-sm min-h-11">
            <option value="all">Tất cả</option>
            <option value="1">Đang bán</option>
            <option value="0">Ngưng bán</option>
          </select>
        </label>
        <button type="submit" className="btn-primary-sm min-h-11">
          Lọc
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className="card-padded">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium text-slate-700">Không có dữ liệu</p>
          </div>
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Mã</th>
                  <th className="px-4 py-3.5 font-semibold">Tên</th>
                  <th className="px-4 py-3.5 font-semibold">Nhóm</th>
                  <th className="px-4 py-3.5 font-semibold">Biến thể</th>
                  <th className="px-4 py-3.5 font-semibold">Giá</th>
                  <th className="px-4 py-3.5 font-semibold">SP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-t border-border ${
                      index % 2 === 1 ? "bg-surface-muted/50" : "bg-surface"
                    }`}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold">{row.code}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-4 py-3.5 text-slate-600">{row.groupName ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {row.variantCount} · {row.variantSelling} bán
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {row.minPrice == null
                        ? "—"
                        : row.minPrice === row.maxPrice
                          ? formatMoney(row.minPrice)
                          : `${formatMoney(row.minPrice)} – ${formatMoney(row.maxPrice!)}`}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.selling ? (
                        <span className="text-emerald-700">Có sẵn</span>
                      ) : (
                        <span className="text-slate-500">Ngưng</span>
                      )}
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
