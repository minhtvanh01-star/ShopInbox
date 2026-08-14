"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "@/app/(app)/actions";
import { ORDER_STATUS_LABEL } from "@/lib/labels";
import type { OrderStatus } from "@/lib/types";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

const STATUS_TONE: Record<OrderStatus, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-800",
  confirmed: "border-teal-200 bg-teal-50 text-teal-800",
  shipping: "border-amber-200 bg-amber-50 text-amber-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
};

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value as OrderStatus;
        startTransition(async () => {
          await updateOrderStatus(orderId, next);
        });
      }}
      className={`h-9 min-w-[8.5rem] cursor-pointer rounded-lg border px-2.5 text-sm font-medium outline-none transition focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${STATUS_TONE[status]}`}
    >
      {STATUSES.map((item) => (
        <option key={item} value={item}>
          {ORDER_STATUS_LABEL[item]}
        </option>
      ))}
    </select>
  );
}
