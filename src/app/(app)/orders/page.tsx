import { ChannelBadge } from "@/components/ChannelBadge";
import { OrderStatusSelect } from "@/components/OrderStatusSelect";
import { formatMoney, formatTime, orderTotal } from "@/lib/labels";
import { getOrdersPageData } from "@/lib/queries";

export default async function OrdersPage() {
  const orders = await getOrdersPageData();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header">
        <h1 className="page-title">Đơn hàng</h1>
        <p className="page-subtitle">
          Tạo từ Inbox, lưu PostgreSQL. Đổi trạng thái ngay trên bảng.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {orders.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium text-slate-700">Chưa có đơn hàng</p>
            <p className="mt-1 text-sm text-slate-500">Tạo đơn từ Inbox khi chat với khách</p>
          </div>
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Mã</th>
                  <th className="px-4 py-3.5 font-semibold">Khách</th>
                  <th className="px-4 py-3.5 font-semibold">Kênh</th>
                  <th className="px-4 py-3.5 font-semibold">Tổng</th>
                  <th className="px-4 py-3.5 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3.5 font-semibold">Ngày</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr
                    key={order.id}
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
                      <OrderStatusSelect orderId={order.id} status={order.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{formatTime(order.createdAt)}</td>
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
