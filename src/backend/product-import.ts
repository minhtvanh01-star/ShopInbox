import { prisma } from "@/backend/prisma";
import { updateProductWithVariants } from "@/backend/product-catalog";
import { VARIANT_MAX_PER_PRODUCT } from "@/lib/product-catalog";
import {
  parseVariantImportMatrix,
  type VariantImportParseResult,
} from "@/lib/product-import";

export type VariantImportApplyResult = {
  added: number;
  updated: number;
  kept: number;
  errors: string[];
  rowCount: number;
};

export function previewVariantImport(matrix: unknown[][]): VariantImportParseResult {
  return parseVariantImportMatrix(matrix);
}

/** Nhập biến thể vào sản phẩm đã có — khớp SKU/tên; giữ biến thể không có trong file. */
export async function applyVariantImport(
  shopId: string,
  productId: string,
  matrix: unknown[][],
): Promise<VariantImportApplyResult> {
  const parsed = parseVariantImportMatrix(matrix);
  if (parsed.variants.length === 0) {
    return {
      added: 0,
      updated: 0,
      kept: 0,
      errors: parsed.errors.length
        ? parsed.errors
        : ["Không có biến thể hợp lệ để nhập."],
      rowCount: parsed.rowCount,
    };
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, shopId },
    include: { variants: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  if (!product) {
    return {
      added: 0,
      updated: 0,
      kept: 0,
      errors: ["Không tìm thấy sản phẩm."],
      rowCount: parsed.rowCount,
    };
  }

  const usedExistingIds = new Set<string>();
  const fromFile = parsed.variants.map((variant, index) => {
    const bySku =
      variant.sku != null && variant.sku !== ""
        ? product.variants.find(
            (row) => row.sku && row.sku === variant.sku && !usedExistingIds.has(row.id),
          )
        : undefined;
    const match =
      bySku ??
      product.variants.find(
        (row) =>
          row.name.trim().toLowerCase() === variant.name.trim().toLowerCase() &&
          !usedExistingIds.has(row.id),
      );
    if (match) usedExistingIds.add(match.id);
    return {
      id: match?.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      costPrice: variant.costPrice,
      selling: variant.selling,
      sortOrder: index,
    };
  });

  const kept = product.variants
    .filter((row) => !usedExistingIds.has(row.id))
    .map((row, index) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      price: row.price,
      costPrice: row.costPrice,
      selling: row.selling,
      sortOrder: fromFile.length + index,
    }));

  const rebuilt = [...fromFile, ...kept];
  if (rebuilt.length > VARIANT_MAX_PER_PRODUCT) {
    return {
      added: 0,
      updated: 0,
      kept: 0,
      errors: [
        ...parsed.errors,
        `Tối đa ${VARIANT_MAX_PER_PRODUCT} biến thể / sản phẩm (sau nhập sẽ có ${rebuilt.length}).`,
      ],
      rowCount: parsed.rowCount,
    };
  }

  await updateProductWithVariants(shopId, productId, {
    code: product.code,
    name: product.name,
    groupId: product.groupId,
    vatPolicy: product.vatPolicy,
    taxRate: product.taxRate,
    selling: product.selling,
    variants: rebuilt,
  });

  return {
    added: fromFile.filter((v) => !v.id).length,
    updated: fromFile.filter((v) => v.id).length,
    kept: kept.length,
    errors: parsed.errors,
    rowCount: parsed.rowCount,
  };
}
