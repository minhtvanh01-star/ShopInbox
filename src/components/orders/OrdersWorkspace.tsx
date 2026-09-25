"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChannelBadge } from "@/components/ChannelBadge";
import { OrderStatusSelect } from "@/components/OrderStatusSelect";
import { PaginationBar } from "@/components/PaginationBar";
import {
  OrderChecklistPanel,
  type OrderChecklistItemView,
} from "@/components/orders/OrderChecklistPanel";
import { mergeCustomerOpenOrdersAction } from "@/app/(app)/actions";
import { formatMoney, formatTime, orderTotal, ORDER_STATUS_LABEL } from "@/lib/labels";
import type { PageMeta } from "@/lib/pagination";
import type { Channel, OrderStatus } from "@/lib/types";

export type OrderListItem = {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  channel: Channel;
  status: OrderStatus;
  createdAt: string;
  items: Array<{ qty: number; price: number }>;
  checklist: OrderChecklistItemView[];
};

const STATUS_OPTIONS: Array<OrderStatus | ""> = [
  "",
  "new",
  "confirmed",
  "shipping",
  "done",
  "cancelled",
];

export function OrdersWorkspace({
  orders,
  canMerge,
  canToggleChecklist,
  filters,
  pageMeta,
}: {
  orders: OrderListItem[];
  canMerge: boolean;
  canToggleChecklist: boolean;
  filters: { q: string; status: string; from: string; to: string };
  pageMeta: PageMeta;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mergeGroups = useMemo(() => {
    const byCustomer = new Map<string, OrderListItem[]>();
    for (const order of orders) {
      if (order.status !== "new") continue;
      const list = byCustomer.get(order.customerId) ?? [];
      list.push(order);
      byCustomer.set(order.customerId, list);
    }
    return [...byCustomer.entries()]
      .filter(([, list]) => list.length >= 2)
      .map(([customerId, list]) => ({
        customerId,
        customerName: list[0]!.customerName,
        count: list.length,
        codes: list.map((item) => item.code),
      }));
  }, [orders]);

  function mergeGroup(customerId: string) {
    startTransition(async () => {
      const result = await mergeCustomerOpenOrdersAction(customerId);
      setFlash(
        result.ok
          ? { ok: true, text: result.message }
          : { ok: false, text: result.error },
      );
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Đơn hàng</h1>
          <p className="page-subtitle">
            Tạo từ Inbox. {pageMeta.total} đơn theo bộ lọc hiện tại.
          </p>
        </div>
        <Link href="/orders/summary" className="btn-secondary min-h-11">
          Tổng hợp
        </Link>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-6 py-4"
      >
        <label className="min-w-[12rem] flex-1 text-xs">
          <span className="label">Tìm kiếm</span>
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Mã đơn hoặc tên khách…"
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
        <button type="submit" className="btn-primary-sm min-h-11">
          Lọc
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {flash ? (
          <p
            role={flash.ok ? "status" : "alert"}
            className={`mb-4 text-sm ${flash.ok ? "alert-success" : "alert-error"}`}
          >
            {flash.text}
          </p>
        ) : null}

        {canMerge && mergeGroups.length > 0 ? (
          <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
            <p className="text-sm font-semibold text-amber-950">Gộp đơn «Mới» cùng khách</p>
            <p className="mt-1 text-xs text-amber-800">
              Chỉ hiện trên trang hiện tại — mở rộng khoảng lọc nếu cần.
            </p>
            <ul className="mt-2 space-y-2">
              {mergeGroups.map((group) => (
                <li
                  key={group.customerId}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900"
                >
                  <span>
                    {group.customerName}: {group.codes.join(", ")} ({group.count} đơn)
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    className="btn-secondary min-h-9 px-3 py-1.5"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Gộp ${group.count} đơn mới của «${group.customerName}» vào đơn cũ nhất? Các đơn còn lại sẽ hủy.`,
                        )
                      ) {
                        mergeGroup(group.customerId);
                      }
                    }}
                  >
                    Gộp đơn
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {orders.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium text-slate-700">Chưa có đơn hàng phù hợp</p>
            <p className="mt-1 text-sm text-slate-500">Tạo đơn từ Inbox hoặc đổi bộ lọc</p>
          </div>
        ) : (
          <>
            <div className="table-shell overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold">Mã</th>
                    <th className="px-4 py-3.5 font-semibold">Khách</th>
                    <th className="px-4 py-3.5 font-semibold">Kênh</th>
                    <th className="px-4 py-3.5 font-semibold">Tổng</th>
                    <th className="px-4 py-3.5 font-semibold">Checklist</th>
                    <th className="px-4 py-3.5 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3.5 font-semibold">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const done = order.checklist.filter((item) => item.done).length;
                    const total = order.checklist.length;
                    const expanded = expandedId === order.id;
                    return (
                      <Fragment key={order.id}>
                        <tr
                          className={`border-t border-border transition-colors duration-200 hover:bg-teal-50/50 ${
                            index % 2 === 1 ? "bg-surface-muted/50" : "bg-surface"
                          }`}
                        >
                          <td className="px-4 py-3.5 font-semibold text-slate-900">{order.code}</td>
                          <td className="px-4 py-3.5 text-slate-700">{order.customerName}</td>
                          <td className="px-4 py-3.5">
                            <ChannelBadge channel={order.channel} />
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-800">
                            {formatMoney(orderTotal(order.items))}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              className="btn-ghost inline-flex min-h-11 items-center gap-1.5 px-2.5 text-xs font-semibold text-teal-800"
                              aria-expanded={expanded}
                              aria-controls={`order-checklist-${order.id}`}
                              onClick={() =>
                                setExpandedId((current) =>
                                  current === order.id ? null : order.id,
                                )
                              }
                            >
                              <span>{total === 0 ? "Checklist" : `${done}/${total}`}</span>
                              <ChevronIcon open={expanded} />
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <OrderStatusSelect orderId={order.id} status={order.status} />
                            <span className="sr-only">{ORDER_STATUS_LABEL[order.status]}</span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500">
                            {formatTime(order.createdAt)}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-t border-border bg-teal-50/40">
                            <td
                              colSpan={7}
                              id={`order-checklist-${order.id}`}
                              className="px-4 py-4"
                            >
                              <OrderChecklistPanel
                                orderId={order.id}
                                items={order.checklist}
                                canToggle={canToggleChecklist}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              basePath="/orders"
              params={{
                q: filters.q || undefined,
                status: filters.status || undefined,
                from: filters.from || undefined,
                to: filters.to || undefined,
              }}
              meta={pageMeta}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
