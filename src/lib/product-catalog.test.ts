import { describe, expect, it } from "vitest";
import {
  parseProductCatalogInput,
  suggestNextProductCode,
  VAT_POLICY_LABEL,
} from "./product-catalog";

describe("parseProductCatalogInput", () => {
  it("parse sản phẩm + biến thể", () => {
    const result = parseProductCatalogInput({
      code: "sp010",
      name: "Áo khoác",
      vatPolicy: "exempt",
      selling: "on",
      variants: [
        { name: "M / Đen", sku: "AK-M-DEN", price: "450000", costPrice: "200000", selling: "on" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.code).toBe("SP010");
      expect(result.value.variants[0]?.price).toBe(450000);
    }
  });

  it("bắt buộc có biến thể", () => {
    expect(
      parseProductCatalogInput({ code: "SP1", name: "X", variants: [] }).ok,
    ).toBe(false);
  });
});

describe("suggestNextProductCode", () => {
  it("tăng từ mã SP", () => {
    expect(suggestNextProductCode(["SP001", "SP009"])).toBe("SP010");
  });
});

describe("VAT_POLICY_LABEL", () => {
  it("có nhãn tiếng Việt", () => {
    expect(VAT_POLICY_LABEL.exempt).toContain("Miễn");
  });
});
