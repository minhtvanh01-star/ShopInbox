import { prisma } from "@/backend/prisma";
import { isUniqueConstraintError } from "@/backend/prisma-errors";
import type { VatPolicy } from "@/generated/prisma/client";
import {
  parseProductCatalogInput,
  parseProductGroupName,
  PRODUCT_GROUP_MAX_PER_SHOP,
  PRODUCT_MAX_PER_SHOP,
  suggestNextProductCode,
  type ProductCatalogInput,
} from "@/lib/product-catalog";

export async function listProductGroups(shopId: string) {
  return prisma.productGroup.findMany({
    where: { shopId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createProductGroup(shopId: string, rawName: string) {
  const parsed = parseProductGroupName(rawName);
  if (!parsed.ok) throw new Error(parsed.error);

  const count = await prisma.productGroup.count({ where: { shopId } });
  if (count >= PRODUCT_GROUP_MAX_PER_SHOP) {
    throw new Error(`Mỗi shop tối đa ${PRODUCT_GROUP_MAX_PER_SHOP} nhóm.`);
  }

  const duplicate = await prisma.productGroup.findFirst({
    where: { shopId, name: parsed.value },
  });
  if (duplicate) {
    throw new Error("Nhóm đã tồn tại.");
  }

  return prisma.productGroup.create({
    data: {
      id: `pg-${crypto.randomUUID()}`,
      shopId,
      name: parsed.value,
      sortOrder: count,
    },
  });
}

export async function deleteProductGroup(shopId: string, id: string) {
  const existing = await prisma.productGroup.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Không tìm thấy nhóm.");
  await prisma.productGroup.delete({ where: { id } });
  return existing;
}

export async function listProductsDetailed(
  shopId: string,
  options?: {
    q?: string;
    groupId?: string;
    selling?: "all" | "1" | "0";
    page?: number;
    pageSize?: number;
  },
) {
  const q = options?.q?.trim() ?? "";
  const groupId = options?.groupId?.trim() || "all";
  const selling = options?.selling ?? "all";
  const pageSize = options?.pageSize ?? 25;

  const where = {
    shopId,
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { group: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(groupId === "none" ? { groupId: null } : {}),
    ...(groupId !== "all" && groupId !== "none" ? { groupId } : {}),
    ...(selling === "1" ? { selling: true } : {}),
    ...(selling === "0" ? { selling: false } : {}),
  };

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const page = Math.min(Math.max(1, options?.page ?? 1), pageCount);

  const rows = await prisma.product.findMany({
    where,
    include: {
      group: true,
      variants: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
    orderBy: [{ name: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return { total, page, rows };
}

export async function getProductDetailed(shopId: string, id: string) {
  return prisma.product.findFirst({
    where: { id, shopId },
    include: {
      group: true,
      variants: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
}

export async function suggestProductCode(shopId: string) {
  const rows = await prisma.product.findMany({
    where: { shopId },
    select: { code: true },
  });
  return suggestNextProductCode(rows.map((row) => row.code));
}

/** Biến thể đang bán — dùng khi tạo đơn Inbox. */
export async function listSellableVariants(shopId: string) {
  const variants = await prisma.productVariant.findMany({
    where: {
      selling: true,
      product: { shopId, selling: true },
    },
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return variants.map((variant) => ({
    id: variant.id,
    productId: variant.productId,
    productName: variant.product.name,
    productCode: variant.product.code,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    label:
      variant.name === variant.product.name
        ? `${variant.product.name}${variant.sku ? ` (${variant.sku})` : ""}`
        : `${variant.product.name} — ${variant.name}${variant.sku ? ` (${variant.sku})` : ""}`,
  }));
}

async function assertGroup(shopId: string, groupId: string | null) {
  if (!groupId) return null;
  const group = await prisma.productGroup.findFirst({ where: { id: groupId, shopId } });
  if (!group) throw new Error("Nhóm sản phẩm không hợp lệ.");
  return group.id;
}

export async function createProductWithVariants(
  shopId: string,
  raw: Parameters<typeof parseProductCatalogInput>[0],
) {
  const parsed = parseProductCatalogInput(raw);
  if (!parsed.ok) throw new Error(parsed.error);

  const count = await prisma.product.count({ where: { shopId } });
  if (count >= PRODUCT_MAX_PER_SHOP) {
    throw new Error(`Mỗi shop tối đa ${PRODUCT_MAX_PER_SHOP} sản phẩm.`);
  }

  const codeTaken = await prisma.product.findFirst({
    where: { shopId, code: parsed.value.code },
  });
  if (codeTaken) throw new Error(`Mã «${parsed.value.code}» đã dùng.`);

  const groupId = await assertGroup(shopId, parsed.value.groupId);
  const productId = `p-${crypto.randomUUID()}`;

  try {
    return await prisma.product.create({
      data: {
        id: productId,
        shopId,
        groupId,
        code: parsed.value.code,
        name: parsed.value.name,
        vatPolicy: parsed.value.vatPolicy as VatPolicy,
        taxRate: parsed.value.taxRate,
        selling: parsed.value.selling,
        variants: {
          create: parsed.value.variants.map((variant, index) => ({
            id: `pv-${crypto.randomUUID()}`,
            sku: variant.sku,
            name: variant.name,
            price: variant.price,
            costPrice: variant.costPrice,
            selling: variant.selling,
            sortOrder: variant.sortOrder ?? index,
          })),
        },
      },
      include: { variants: true, group: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(`Mã «${parsed.value.code}» đã dùng.`);
    }
    throw error;
  }
}

export async function updateProductWithVariants(
  shopId: string,
  productId: string,
  raw: Parameters<typeof parseProductCatalogInput>[0],
) {
  const parsed = parseProductCatalogInput(raw);
  if (!parsed.ok) throw new Error(parsed.error);

  const existing = await prisma.product.findFirst({
    where: { id: productId, shopId },
    include: { variants: true },
  });
  if (!existing) throw new Error("Không tìm thấy sản phẩm.");

  const codeTaken = await prisma.product.findFirst({
    where: { shopId, code: parsed.value.code, NOT: { id: productId } },
  });
  if (codeTaken) throw new Error(`Mã «${parsed.value.code}» đã dùng.`);

  const groupId = await assertGroup(shopId, parsed.value.groupId);
  const incomingIds = new Set(
    parsed.value.variants.map((variant) => variant.id).filter(Boolean) as string[],
  );
  const toDelete = existing.variants.filter((variant) => !incomingIds.has(variant.id));

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        groupId,
        code: parsed.value.code,
        name: parsed.value.name,
        vatPolicy: parsed.value.vatPolicy as VatPolicy,
        taxRate: parsed.value.taxRate,
        selling: parsed.value.selling,
      },
    });

    if (toDelete.length > 0) {
      await tx.productVariant.deleteMany({
        where: { id: { in: toDelete.map((item) => item.id) }, productId },
      });
    }

    for (const [index, variant] of parsed.value.variants.entries()) {
      if (variant.id && existing.variants.some((row) => row.id === variant.id)) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            sku: variant.sku,
            name: variant.name,
            price: variant.price,
            costPrice: variant.costPrice,
            selling: variant.selling,
            sortOrder: variant.sortOrder ?? index,
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            id: `pv-${crypto.randomUUID()}`,
            productId,
            sku: variant.sku,
            name: variant.name,
            price: variant.price,
            costPrice: variant.costPrice,
            selling: variant.selling,
            sortOrder: variant.sortOrder ?? index,
          },
        });
      }
    }
  });

  return getProductDetailed(shopId, productId);
}

export async function deleteProductCascade(shopId: string, id: string) {
  const existing = await prisma.product.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Không tìm thấy sản phẩm.");
  await prisma.product.delete({ where: { id } });
  return existing;
}

export type { ProductCatalogInput };
