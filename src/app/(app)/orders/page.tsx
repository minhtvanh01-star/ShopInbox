import { OrdersWorkspace } from "@/components/orders/OrdersWorkspace";
import { getOrdersPageData, getShopContext } from "@/lib/queries";
import { PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

type OrdersPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const from = params.from?.trim() ?? "";
  const to = params.to?.trim() ?? "";

  const [listed, shop] = await Promise.all([
    getOrdersPageData({
      q,
      status,
      from,
      to,
      page: parsePage(params.page),
      pageSize: PAGE_SIZE,
    }),
    getShopContext(),
  ]);

  return (
    <OrdersWorkspace
      orders={listed.orders}
      canMerge={shop.permissions.includes(PERMISSION_CODES.ordersUpdate)}
      canToggleChecklist={shop.permissions.includes(PERMISSION_CODES.ordersUpdate)}
      filters={{ q, status, from, to }}
      pageMeta={paginationMeta(listed.total, listed.page, PAGE_SIZE)}
    />
  );
}
