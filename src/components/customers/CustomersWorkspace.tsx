"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mergeCustomersAction } from "@/app/(app)/actions";
import { customerMatchesQuery } from "@/lib/customer-profile";

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  orderCount: number;
  latestConversationId: string | null;
};

export function CustomersWorkspace({
  customers,
  canMerge,
}: {
  customers: CustomerListItem[];
  canMerge: boolean;
}) {
  const [query, setQuery] = useState("");
  const [keepId, setKeepId] = useState("");
  const [absorbId, setAbsorbId] = useState("");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(
    () => customers.filter((item) => customerMatchesQuery(item, query)),
    [customers, query],
  );

  function runMerge() {
    if (!keepId || !absorbId) {
      setFlash({ ok: false, text: "Chọn khách giữ lại và khách sẽ gộp vào." });
      return;
    }
    if (keepId === absorbId) {
      setFlash({ ok: false, text: "Hai khách phải khác nhau." });
      return;
    }
    const keep = customers.find((item) => item.id === keepId);
    const absorb = customers.find((item) => item.id === absorbId);
    if (
      !window.confirm(
        `Gộp «${absorb?.name}» vào «${keep?.name}»? Hội thoại/đơn sẽ chuyển; hồ sơ gộp sẽ bị xóa.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await mergeCustomersAction(keepId, absorbId);
      setFlash(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      if (result.ok) {
        setAbsorbId("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header">
        <h1 className="page-title">Khách hàng</h1>
        <p className="page-subtitle">
          {customers.length} khách · tìm tên / SĐT rồi mở hội thoại Inbox
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {flash ? (
          <p
            role={flash.ok ? "status" : "alert"}
            className={`mb-4 text-sm ${flash.ok ? "alert-success" : "alert-error"}`}
          >
            {flash.text}
          </p>
        ) : null}

        {canMerge && customers.length >= 2 ? (
          <section className="mb-5 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Gộp khách trùng</p>
            <p className="mt-1 text-xs text-slate-500">
              Giữ một hồ sơ; chuyển hội thoại/đơn; identity cùng kênh giữ bản của khách đích.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs">
                <span className="label">Khách giữ lại</span>
                <select
                  value={keepId}
                  onChange={(event) => setKeepId(event.target.value)}
                  className="input-field-sm min-h-11"
                >
                  <option value="">— Chọn —</option>
                  {customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.phone ? ` (${item.phone})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="label">Khách sẽ gộp vào (xóa)</span>
                <select
                  value={absorbId}
                  onChange={(event) => setAbsorbId(event.target.value)}
                  className="input-field-sm min-h-11"
                >
                  <option value="">— Chọn —</option>
                  {customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.phone ? ` (${item.phone})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={pending}
              className="btn-primary-sm mt-3 min-h-9"
              onClick={runMerge}
            >
              {pending ? "Đang gộp…" : "Gộp khách"}
            </button>
          </section>
        ) : null}

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
              className="input-field-sm mb-5 max-w-md min-h-11"
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
