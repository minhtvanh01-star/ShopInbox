import { getOrderSummary } from "@/backend/order-summary";
import { requirePermission } from "@/backend/rbac";
import { OrderSummaryWorkspace } from "@/components/orders/OrderSummaryWorkspace";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

type PageProps = {
  searchParams: Promise<{
    view?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
};

export default async function OrderSummaryPage({ searchParams }: PageProps) {
  const session = await requirePermission(PERMISSION_CODES.ordersRead);
  const params = await searchParams;
  const viewRaw = params.view?.trim() ?? "day";
  const view = viewRaw === "month" || viewRaw === "year" ? viewRaw : "day";
  const from = params.from?.trim() ?? "";
  const to = params.to?.trim() ?? "";
  const status = params.status?.trim() ?? "";

  const summary = await getOrderSummary(session.shopId, { view, from, to, status });

  return (
    <OrderSummaryWorkspace
      view={summary.view}
      buckets={summary.buckets}
      totals={summary.totals}
      filters={{ from, to, status }}
    />
  );
}
