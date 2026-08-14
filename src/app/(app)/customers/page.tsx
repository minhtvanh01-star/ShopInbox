import { getCustomersPageData } from "@/lib/queries";

export default async function CustomersPage() {
  const customers = await getCustomersPageData();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Khách hàng</h1>
        <p className="text-sm text-slate-500">{customers.length} khách từ PostgreSQL</p>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-auto p-6">
        {customers.map((customer) => (
          <article key={customer.id} className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">{customer.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{customer.phone ?? "Chưa có SĐT"}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{customer.note}</p>
            <p className="mt-3 text-xs text-slate-400">{customer.orderCount} đơn đã lưu</p>
          </article>
        ))}
      </div>
    </div>
  );
}
