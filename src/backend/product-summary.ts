import { prisma } from "@/backend/prisma";

export type ProductSummaryFilters = {
  groupId?: string;
  selling?: "all" | "1" | "0";
};

export async function getProductSummary(shopId: string, filters: ProductSummaryFilters = {}) {
  const groupId = filters.groupId?.trim() || "all";
  const selling = filters.selling ?? "all";

  const where = {
    shopId,
    ...(groupId === "none" ? { groupId: null } : {}),
    ...(groupId !== "all" && groupId !== "none" ? { groupId } : {}),
    ...(selling === "1" ? { selling: true } : {}),
    ...(selling === "0" ? { selling: false } : {}),
  };

  const [products, groupCount] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        group: true,
        variants: { select: { id: true, price: true, selling: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.productGroup.count({ where: { shopId } }),
  ]);

  let variantTotal = 0;
  let variantSelling = 0;
  let productSelling = 0;

  const rows = products.map((product) => {
    variantTotal += product.variants.length;
    const sellingVariants = product.variants.filter((v) => v.selling).length;
    variantSelling += sellingVariants;
    if (product.selling) productSelling += 1;
    const prices = product.variants.map((v) => v.price);
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      groupName: product.group?.name ?? null,
      selling: product.selling,
      variantCount: product.variants.length,
      variantSelling: sellingVariants,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
    };
  });

  return {
    totals: {
      products: products.length,
      productSelling,
      productOff: products.length - productSelling,
      variants: variantTotal,
      variantSelling,
      variantOff: variantTotal - variantSelling,
      groups: groupCount,
    },
    rows,
  };
}
