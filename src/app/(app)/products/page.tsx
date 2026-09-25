import { ProductsWorkspace } from "@/components/products/ProductsWorkspace";
import {
  listProductGroups,
  listProductsDetailed,
  suggestProductCode,
} from "@/backend/product-catalog";
import { getPermissionCodes, requirePermission } from "@/backend/rbac";
import { PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";
import type { Product, ProductGroup } from "@/lib/types";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    groupId?: string;
    selling?: string;
    page?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await requirePermission(PERMISSION_CODES.ordersRead);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const groupId = params.groupId?.trim() || "all";
  const sellingRaw = params.selling?.trim() ?? "all";
  const selling =
    sellingRaw === "1" || sellingRaw === "0" || sellingRaw === "all" ? sellingRaw : "all";

  const [listed, groupRows, suggestedCode, permissions] = await Promise.all([
    listProductsDetailed(session.shopId, {
      q,
      groupId,
      selling,
      page: parsePage(params.page),
      pageSize: PAGE_SIZE,
    }),
    listProductGroups(session.shopId),
    suggestProductCode(session.shopId),
    getPermissionCodes(session),
  ]);

  const products: Product[] = listed.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    groupId: row.groupId,
    groupName: row.group?.name ?? null,
    vatPolicy: row.vatPolicy,
    taxRate: row.taxRate,
    selling: row.selling,
    variants: row.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku ?? undefined,
      name: variant.name,
      price: variant.price,
      costPrice: variant.costPrice,
      selling: variant.selling,
      sortOrder: variant.sortOrder,
    })),
  }));

  const groups: ProductGroup[] = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    sortOrder: group.sortOrder,
  }));

  return (
    <ProductsWorkspace
      products={products}
      groups={groups}
      suggestedCode={suggestedCode}
      canManage={permissions.includes(PERMISSION_CODES.productsManage)}
      filters={{ q, groupId, selling }}
      pageMeta={paginationMeta(listed.total, listed.page, PAGE_SIZE)}
    />
  );
}
