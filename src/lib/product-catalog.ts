/** Validate sản phẩm + biến thể + nhóm. */

export const PRODUCT_NAME_MAX = 120;
export const PRODUCT_CODE_MAX = 40;
export const PRODUCT_SKU_MAX = 40;
export const PRODUCT_MAX_PER_SHOP = 500;
export const VARIANT_MAX_PER_PRODUCT = 50;
export const PRODUCT_PRICE_MAX = 100_000_000;
export const PRODUCT_GROUP_NAME_MAX = 80;
export const PRODUCT_GROUP_MAX_PER_SHOP = 50;

export const VAT_POLICIES = ["exempt", "taxable", "zero"] as const;
export type VatPolicyCode = (typeof VAT_POLICIES)[number];

export const VAT_POLICY_LABEL: Record<VatPolicyCode, string> = {
  exempt: "Miễn thuế",
  taxable: "Chịu thuế",
  zero: "Thuế 0%",
};

export type ProductVariantInput = {
  id?: string;
  sku: string | null;
  name: string;
  price: number;
  costPrice: number;
  selling: boolean;
  sortOrder: number;
};

export type ProductCatalogInput = {
  code: string;
  name: string;
  groupId: string | null;
  vatPolicy: VatPolicyCode;
  taxRate: number | null;
  selling: boolean;
  variants: ProductVariantInput[];
};

export function parseProductPrice(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw);
  }
  const text = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function asBool(raw: string | boolean | null | undefined, defaultValue = false) {
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  return raw === true || raw === "true" || raw === "1" || raw === "on";
}

export function parseVatPolicy(raw: string | null | undefined): VatPolicyCode {
  const value = (raw ?? "").trim();
  if (VAT_POLICIES.includes(value as VatPolicyCode)) {
    return value as VatPolicyCode;
  }
  return "exempt";
}

export function parseProductGroupName(raw: string | null | undefined) {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false as const, error: "Nhập tên nhóm." };
  if (name.length > PRODUCT_GROUP_NAME_MAX) {
    return { ok: false as const, error: `Tên nhóm tối đa ${PRODUCT_GROUP_NAME_MAX} ký tự.` };
  }
  return { ok: true as const, value: name };
}

export function parseVariantInput(
  raw: {
    id?: string | null;
    sku?: string | null;
    name?: string | null;
    price?: string | number | null;
    costPrice?: string | number | null;
    selling?: string | boolean | null;
    sortOrder?: string | number | null;
  },
  index: number,
): { ok: true; value: ProductVariantInput } | { ok: false; error: string } {
  const name = (raw.name ?? "").trim().replace(/\s+/g, " ");
  const skuRaw = (raw.sku ?? "").trim();
  const sku = skuRaw ? skuRaw.slice(0, PRODUCT_SKU_MAX) : null;
  const price = parseProductPrice(raw.price);
  const costPrice = parseProductPrice(raw.costPrice ?? 0);
  const selling = asBool(raw.selling, true);
  let sortOrder = index;
  if (typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)) {
    sortOrder = Math.round(raw.sortOrder);
  } else if (raw.sortOrder != null && String(raw.sortOrder).trim()) {
    const parsed = Number(String(raw.sortOrder).trim());
    if (Number.isFinite(parsed)) sortOrder = Math.round(parsed);
  }

  if (!name) {
    return { ok: false, error: `Biến thể #${index + 1}: nhập tên (vd. Size M / Đỏ).` };
  }
  if (name.length > PRODUCT_NAME_MAX) {
    return { ok: false, error: `Biến thể #${index + 1}: tên quá dài.` };
  }
  if (price === null || price < 0) {
    return { ok: false, error: `Biến thể #${index + 1}: đơn giá không hợp lệ.` };
  }
  if (price > PRODUCT_PRICE_MAX) {
    return { ok: false, error: `Biến thể #${index + 1}: đơn giá quá lớn.` };
  }
  if (costPrice === null || costPrice < 0) {
    return { ok: false, error: `Biến thể #${index + 1}: giá vốn không hợp lệ.` };
  }

  return {
    ok: true,
    value: {
      id: raw.id?.trim() || undefined,
      sku,
      name,
      price,
      costPrice,
      selling,
      sortOrder,
    },
  };
}

export function parseProductCatalogInput(raw: {
  code?: string | null;
  name?: string | null;
  groupId?: string | null;
  vatPolicy?: string | null;
  taxRate?: string | number | null;
  selling?: string | boolean | null;
  variants?: Array<{
    id?: string | null;
    sku?: string | null;
    name?: string | null;
    price?: string | number | null;
    costPrice?: string | number | null;
    selling?: string | boolean | null;
    sortOrder?: string | number | null;
  }>;
}): { ok: true; value: ProductCatalogInput } | { ok: false; error: string } {
  const code = (raw.code ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  const name = (raw.name ?? "").trim().replace(/\s+/g, " ");
  const groupId = (raw.groupId ?? "").trim() || null;
  const vatPolicy = parseVatPolicy(raw.vatPolicy);
  const selling = asBool(raw.selling, true);

  let taxRate: number | null = null;
  if (vatPolicy === "taxable") {
    const parsed = parseProductPrice(raw.taxRate);
    if (parsed === null || parsed < 0 || parsed > 100) {
      return { ok: false, error: "Thuế suất (%) phải từ 0 đến 100." };
    }
    taxRate = parsed;
  }

  if (!code) {
    return { ok: false, error: "Nhập mã sản phẩm (vd. SP010)." };
  }
  if (code.length > PRODUCT_CODE_MAX) {
    return { ok: false, error: `Mã tối đa ${PRODUCT_CODE_MAX} ký tự.` };
  }
  if (!name) {
    return { ok: false, error: "Nhập tên sản phẩm." };
  }
  if (name.length > PRODUCT_NAME_MAX) {
    return { ok: false, error: `Tên tối đa ${PRODUCT_NAME_MAX} ký tự.` };
  }

  const rawVariants = raw.variants ?? [];
  if (rawVariants.length === 0) {
    return { ok: false, error: "Thêm ít nhất một biến thể (size / màu / SKU)." };
  }
  if (rawVariants.length > VARIANT_MAX_PER_PRODUCT) {
    return { ok: false, error: `Tối đa ${VARIANT_MAX_PER_PRODUCT} biến thể / sản phẩm.` };
  }

  const variants: ProductVariantInput[] = [];
  for (let i = 0; i < rawVariants.length; i += 1) {
    const parsed = parseVariantInput(rawVariants[i]!, i);
    if (!parsed.ok) return parsed;
    variants.push(parsed.value);
  }

  return {
    ok: true,
    value: { code, name, groupId, vatPolicy, taxRate, selling, variants },
  };
}

/** Sinh mã gợi ý tiếp theo từ danh sách mã hiện có (SP001…). */
export function suggestNextProductCode(existingCodes: string[]) {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^SP0*(\d+)$/i.exec(code.trim());
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `SP${String(max + 1).padStart(3, "0")}`;
}
