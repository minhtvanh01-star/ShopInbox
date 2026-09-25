import { listProductGroups } from "@/backend/product-catalog";
import { getProductSummary } from "@/backend/product-summary";
import { requirePermission } from "@/backend/rbac";
import { ProductSummaryWorkspace } from "@/components/products/ProductSummaryWorkspace";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

type PageProps = {
  searchParams: Promise<{ groupId?: string; selling?: string }>;
};

export default async function ProductSummaryPage({ searchParams }: PageProps) {
  const session = await requirePermission(PERMISSION_CODES.ordersRead);
  const params = await searchParams;
  const groupId = params.groupId?.trim() || "all";
  const sellingRaw = params.selling?.trim() ?? "all";
  const selling =
    sellingRaw === "1" || sellingRaw === "0" || sellingRaw === "all" ? sellingRaw : "all";

  const [summary, groups] = await Promise.all([
    getProductSummary(session.shopId, { groupId, selling }),
    listProductGroups(session.shopId),
  ]);

  return (
    <ProductSummaryWorkspace
      totals={summary.totals}
      rows={summary.rows}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      filters={{ groupId, selling }}
    />
  );
}
