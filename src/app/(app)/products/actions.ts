"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/backend/audit";
import {
  createProductGroup,
  createProductWithVariants,
  deleteProductCascade,
  deleteProductGroup,
  updateProductWithVariants,
} from "@/backend/product-catalog";
import { requirePermission } from "@/backend/rbac";
import { AUDIT_ACTIONS, PERMISSION_CODES } from "@/lib/rbac-catalog";
import {
  sniffSpreadsheetKind,
  validateSpreadsheetFileForUpload,
} from "@/lib/inbox-media";

export type ProductFormState = {
  error?: string;
  success?: string;
};

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseVariantsJson(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Array<{
      id?: string | null;
      sku?: string | null;
      name?: string | null;
      price?: string | number | null;
      costPrice?: string | number | null;
      selling?: string | boolean | null;
      sortOrder?: string | number | null;
    }>;
  } catch {
    return [];
  }
}

function catalogPayload(formData: FormData) {
  return {
    code: field(formData, "code"),
    name: field(formData, "name"),
    groupId: field(formData, "groupId") || null,
    vatPolicy: field(formData, "vatPolicy"),
    taxRate: field(formData, "taxRate"),
    selling: formData.get("selling") != null,
    variants: parseVariantsJson(field(formData, "variantsJson")),
  };
}

function revalidateCatalog() {
  revalidatePath("/products");
  revalidatePath("/inbox");
  revalidatePath("/orders");
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const session = await requirePermission(PERMISSION_CODES.productsManage);
    const product = await createProductWithVariants(session.shopId, catalogPayload(formData));
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.productCreate,
      entityType: "Product",
      entityId: product.id,
      metadata: {
        code: product.code,
        name: product.name,
        variantCount: product.variants.length,
      },
    });
    revalidateCatalog();
    return { success: `Đã thêm «${product.name}» (${product.variants.length} biến thể).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thêm được sản phẩm." };
  }
}

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const session = await requirePermission(PERMISSION_CODES.productsManage);
    const id = field(formData, "id");
    if (!id) return { error: "Thiếu sản phẩm." };
    const product = await updateProductWithVariants(session.shopId, id, catalogPayload(formData));
    if (!product) return { error: "Không tìm thấy sản phẩm." };
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.productUpdate,
      entityType: "Product",
      entityId: product.id,
      metadata: {
        code: product.code,
        name: product.name,
        variantCount: product.variants.length,
        selling: product.selling,
      },
    });
    revalidateCatalog();
    return { success: `Đã cập nhật «${product.name}».` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không cập nhật được sản phẩm." };
  }
}

export async function deleteProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const session = await requirePermission(PERMISSION_CODES.productsManage);
    const id = field(formData, "id");
    if (!id) return { error: "Thiếu sản phẩm." };
    const product = await deleteProductCascade(session.shopId, id);
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.productDelete,
      entityType: "Product",
      entityId: product.id,
      metadata: { name: product.name, code: product.code },
    });
    revalidateCatalog();
    return { success: `Đã xóa «${product.name}».` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không xóa được sản phẩm." };
  }
}

export async function createProductGroupAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const session = await requirePermission(PERMISSION_CODES.productsManage);
    const group = await createProductGroup(session.shopId, field(formData, "name"));
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.productUpdate,
      entityType: "ProductGroup",
      entityId: group.id,
      metadata: { name: group.name },
    });
    revalidateCatalog();
    return { success: `Đã thêm nhóm «${group.name}».` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thêm được nhóm." };
  }
}

export async function deleteProductGroupAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const session = await requirePermission(PERMISSION_CODES.productsManage);
    const id = field(formData, "id");
    if (!id) return { error: "Thiếu nhóm." };
    const group = await deleteProductGroup(session.shopId, id);
    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.productUpdate,
      entityType: "ProductGroup",
      entityId: group.id,
      metadata: { name: group.name, deleted: true },
    });
    revalidateCatalog();
    return { success: `Đã xóa nhóm «${group.name}».` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không xóa được nhóm." };
  }
}

export async function importProductVariantsAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const session = await requirePermission(PERMISSION_CODES.productsManage);
    const productId = field(formData, "productId");
    if (!productId) return { error: "Thiếu sản phẩm." };

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { error: "Chọn file Excel (.xlsx / .xls)." };
    }
    const fileCheck = validateSpreadsheetFileForUpload({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (!fileCheck.ok) {
      return { error: fileCheck.error };
    }

    const XLSX = await import("xlsx");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!sniffSpreadsheetKind(buffer, file.name)) {
      return { error: "File không phải Excel hợp lệ (.xlsx / .xls)." };
    }
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { error: "File không có sheet." };
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return { error: "Không đọc được sheet." };
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];

    const { applyVariantImport } = await import("@/backend/product-import");
    const result = await applyVariantImport(session.shopId, productId, matrix);

    await writeAudit({
      actor: session,
      action: AUDIT_ACTIONS.productUpdate,
      entityType: "Product",
      entityId: productId,
      metadata: {
        importVariants: true,
        added: result.added,
        updated: result.updated,
        kept: result.kept,
        rowCount: result.rowCount,
        errorCount: result.errors.length,
      },
    });
    revalidateCatalog();

    if (result.added === 0 && result.updated === 0) {
      return {
        error:
          result.errors[0] ??
          "Không nhập được biến thể. Kiểm tra cột variantName / price.",
      };
    }

    const errHint =
      result.errors.length > 0 ? ` · ${result.errors.length} cảnh báo dòng.` : "";
    return {
      success: `Đã nhập biến thể: thêm ${result.added}, cập nhật ${result.updated}, giữ ${result.kept}.${errHint}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không nhập được Excel." };
  }
}
