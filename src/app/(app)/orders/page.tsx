import { ChannelBadge } from "@/components/ChannelBadge";
import { ORDER_STATUS_LABEL, formatMoney, formatTime, orderTotal } from "@/lib/labels";
import { getOrdersPageData } from "@/lib/queries";

export default async function OrdersPage() {
  const orders = await getOrdersPageData();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Đơn hàng</h1>
        <p className="text-sm text-slate-500">
          Đọc từ PostgreSQL — tạo đơn từ chat sẽ làm ở Lát 3
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <table className="w-full overflow-hidden rounded-xl bg-white text-left text-sm shadow-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-4 py-3 font-medium">Khách</th>
              <th className="px-4 py-3 font-medium">Kênh</th>
              <th className="px-4 py-3 font-medium">Tổng</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Ngày</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-800">{order.code}</td>
                <td className="px-4 py-3">{order.customerName}</td>
                <td className="px-4 py-3">
                  <ChannelBadge channel={order.channel} />
                </td>
                <td className="px-4 py-3">{formatMoney(orderTotal(order.items))}</td>
                <td className="px-4 py-3">{ORDER_STATUS_LABEL[order.status]}</td>
                <td className="px-4 py-3 text-slate-500">{formatTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
