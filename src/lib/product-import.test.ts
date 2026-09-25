import { describe, expect, it } from "vitest";
import { mergeImportedVariants, parseVariantImportMatrix } from "./product-import";

describe("parseVariantImportMatrix", () => {
  it("parse danh sách biến thể", () => {
    const result = parseVariantImportMatrix([
      ["variantName", "sku", "price", "costPrice", "selling"],
      ["Size M / Đen", "AK-M", "450000", "200000", "1"],
      ["Size L / Đen", "AK-L", "460000", "200000", "1"],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0]?.name).toBe("Size M / Đen");
    expect(result.variants[0]?.price).toBe(450000);
  });

  it("nhận alias tiếng Việt", () => {
    const result = parseVariantImportMatrix([
      ["Tên biến thể", "SKU", "Đơn giá", "Giá vốn", "Đang bán"],
      ["M", "X1", "100000", "40000", "có"],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.variants).toHaveLength(1);
  });

  it("báo thiếu cột", () => {
    const result = parseVariantImportMatrix([["foo"], ["bar"]]);
    expect(result.variants).toHaveLength(0);
    expect(result.errors[0]).toMatch(/Thiếu cột/i);
  });
});

describe("mergeImportedVariants", () => {
  it("khớp theo sku và giữ biến thể cũ", () => {
    const merged = mergeImportedVariants(
      [
        { id: "pv1", sku: "AK-M", name: "M cũ" },
        { id: "pv2", sku: "AK-S", name: "S" },
      ],
      [
        {
          sku: "AK-M",
          name: "M / Đen",
          price: 450000,
          costPrice: 200000,
          selling: true,
          sortOrder: 0,
        },
        {
          sku: "AK-L",
          name: "L / Đen",
          price: 460000,
          costPrice: 200000,
          selling: true,
          sortOrder: 1,
        },
      ],
    );
    expect(merged.find((v) => v.sku === "AK-M")?.id).toBe("pv1");
    expect(merged.find((v) => v.sku === "AK-L")?.id).toBeUndefined();
    expect(merged.some((v) => v.id === "pv2")).toBe(true);
  });
});
