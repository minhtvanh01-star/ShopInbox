import { getCustomersPageData } from "@/lib/queries";

export default async function CustomersPage() {
  const customers = await getCustomersPageData();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header">
        <h1 className="page-title">Khách hàng</h1>
        <p className="page-subtitle">{customers.length} khách từ PostgreSQL</p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {customers.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium text-slate-700">Chưa có khách hàng</p>
            <p className="mt-1 text-sm text-slate-500">Khách sẽ xuất hiện khi có hội thoại Inbox</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {customers.map((customer) => (
              <article key={customer.id} className="card-padded transition hover:border-teal-200">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">{customer.name}</h2>
                  <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
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
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
