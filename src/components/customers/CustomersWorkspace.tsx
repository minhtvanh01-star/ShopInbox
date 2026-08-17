"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { customerMatchesQuery } from "@/lib/customer-profile";

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  orderCount: number;
  latestConversationId: string | null;
};

export function CustomersWorkspace({ customers }: { customers: CustomerListItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => customers.filter((item) => customerMatchesQuery(item, query)),
    [customers, query],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header">
        <h1 className="page-title">Khách hàng</h1>
        <p className="page-subtitle">
          {customers.length} khách · tìm tên / SĐT rồi mở hội thoại Inbox
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {customers.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium text-slate-700">Chưa có khách hàng</p>
            <p className="mt-1 text-sm text-slate-500">Khách sẽ xuất hiện khi có hội thoại Inbox</p>
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor="customer-search">
              Tìm khách hàng
            </label>
            <input
              id="customer-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên, số điện thoại hoặc ghi chú…"
              className="input-field-sm mb-5 max-w-md"
            />
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500">Không khớp “{query.trim()}”.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((customer) => {
                  const inner = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-semibold text-teal-950">{customer.name}</h2>
                        <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 ring-1 ring-teal-100">
                          {customer.orderCount} đơn
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{customer.phone ?? "Chưa có SĐT"}</p>
                      {customer.note ? (
                        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm leading-6 text-slate-500">
                          {customer.note}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm italic text-slate-400">Chưa có ghi chú</p>
                      )}
                      {customer.latestConversationId ? (
                        <p className="mt-3 text-xs font-semibold text-teal-700">Mở hội thoại →</p>
                      ) : null}
                    </>
                  );

                  if (customer.latestConversationId) {
                    return (
                      <Link
                        key={customer.id}
                        href={`/inbox?c=${encodeURIComponent(customer.latestConversationId)}`}
                        className="card-padded block transition-colors hover:bg-teal-50/40"
                      >
                        {inner}
                      </Link>
                    );
                  }

                  return (
                    <article key={customer.id} className="card-padded">
                      {inner}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
