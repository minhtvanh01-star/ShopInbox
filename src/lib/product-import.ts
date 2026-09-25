/** Parse Excel biến thể cho một sản phẩm đã tồn tại. */

import { parseVariantInput, type ProductVariantInput } from "@/lib/product-catalog";

export const VARIANT_IMPORT_HEADERS = [
  "variantName",
  "sku",
  "price",
  "costPrice",
  "selling",
] as const;

export type VariantImportRow = {
  variantName: string;
  sku: string;
  price: string;
  costPrice: string;
  selling: string;
  rowNumber: number;
};

export type VariantImportParseResult = {
  variants: ProductVariantInput[];
  errors: string[];
  rowCount: number;
};

function cell(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return String(raw).trim();
}

function normalizeHeader(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

const HEADER_ALIASES: Record<string, (typeof VARIANT_IMPORT_HEADERS)[number]> = {
  variantname: "variantName",
  bienthe: "variantName",
  tenbienthe: "variantName",
  name: "variantName",
  ten: "variantName",
  sku: "sku",
  ma: "sku",
  masku: "sku",
  price: "price",
  dongia: "price",
  gia: "price",
  costprice: "costPrice",
  giavon: "costPrice",
  selling: "selling",
  dangban: "selling",
};

function asSellingFlag(raw: string) {
  const v = raw.trim().toLowerCase();
  if (!v || v === "1" || v === "true" || v === "yes" || v === "on" || v === "có" || v === "co") {
    return true;
  }
  if (v === "0" || v === "false" || v === "no" || v === "off" || v === "không" || v === "khong") {
    return false;
  }
  return true;
}

export function mapVariantImportHeaders(headerRow: unknown[]): Partial<
  Record<(typeof VARIANT_IMPORT_HEADERS)[number], number>
> {
  const map: Partial<Record<(typeof VARIANT_IMPORT_HEADERS)[number], number>> = {};
  headerRow.forEach((raw, index) => {
    const key = HEADER_ALIASES[normalizeHeader(cell(raw))];
    if (key && map[key] == null) map[key] = index;
  });
  return map;
}

export function sheetRowsToVariantImportRows(matrix: unknown[][]): VariantImportRow[] {
  if (matrix.length === 0) return [];
  const headerMap = mapVariantImportHeaders(matrix[0] ?? []);
  if (headerMap.variantName == null || headerMap.price == null) return [];

  const rows: VariantImportRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    const get = (key: (typeof VARIANT_IMPORT_HEADERS)[number]) => {
      const idx = headerMap[key];
      return idx == null ? "" : cell(line[idx]);
    };
    const variantName = get("variantName");
    const price = get("price");
    const sku = get("sku");
    if (!variantName && !price && !sku) continue;
    rows.push({
      variantName,
      sku,
      price,
      costPrice: get("costPrice") || "0",
      selling: get("selling") || "1",
      rowNumber: i + 1,
    });
  }
  return rows;
}

export function parseVariantImportMatrix(matrix: unknown[][]): VariantImportParseResult {
  const headerMap = mapVariantImportHeaders(matrix[0] ?? []);
  if (headerMap.variantName == null || headerMap.price == null) {
    return {
      variants: [],
      errors: [
        "Thiếu cột bắt buộc: variantName (tên biến thể) và price (đơn giá). Có thể dùng alias: tên / giá / SKU / giá vốn / đang bán.",
      ],
      rowCount: 0,
    };
  }

  const rawRows = sheetRowsToVariantImportRows(matrix);
  const errors: string[] = [];
  const variants: ProductVariantInput[] = [];

  for (const row of rawRows) {
    const parsed = parseVariantInput(
      {
        name: row.variantName,
        sku: row.sku,
        price: row.price,
        costPrice: row.costPrice,
        selling: asSellingFlag(row.selling),
        sortOrder: variants.length,
      },
      variants.length,
    );
    if (!parsed.ok) {
      errors.push(`Dòng ${row.rowNumber}: ${parsed.error}`);
      continue;
    }
    variants.push(parsed.value);
  }

  if (variants.length === 0 && errors.length === 0) {
    errors.push("File không có dòng biến thể hợp lệ.");
  }

  return { variants, errors, rowCount: rawRows.length };
}

/** Ghép biến thể import vào danh sách hiện có: khớp theo SKU rồi theo tên; giữ biến thể không có trong file. */
export function mergeImportedVariants(
  existing: Array<{ id: string; sku: string | null; name: string }>,
  incoming: ProductVariantInput[],
): ProductVariantInput[] {
  const usedIds = new Set<string>();
  const merged: ProductVariantInput[] = [];

  for (const [index, variant] of incoming.entries()) {
    const bySku =
      variant.sku != null && variant.sku !== ""
        ? existing.find((row) => row.sku && row.sku === variant.sku && !usedIds.has(row.id))
        : undefined;
    const byName =
      bySku ??
      existing.find(
        (row) =>
          row.name.trim().toLowerCase() === variant.name.trim().toLowerCase() &&
          !usedIds.has(row.id),
      );
    if (byName) usedIds.add(byName.id);
    merged.push({
      ...variant,
      id: byName?.id,
      sortOrder: index,
    });
  }

  for (const row of existing) {
    if (usedIds.has(row.id)) continue;
    // Giữ biến thể cũ không có trong Excel — caller sẽ lấy full fields từ DB
    merged.push({
      id: row.id,
      sku: row.sku,
      name: row.name,
      price: 0,
      costPrice: 0,
      selling: true,
      sortOrder: merged.length,
      // placeholder — apply layer replaces with DB values
    });
  }

  return merged;
}
