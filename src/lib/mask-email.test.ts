import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("keeps the domain and masks the middle of the local part", () => {
    expect(maskEmail("minhtvanh05@gmail.com")).toBe("mi***05@gmail.com");
    expect(maskEmail("  Admin@Lily.vn ")).toBe("ad***in@lily.vn");
  });

  it("handles short local parts", () => {
    expect(maskEmail("a@shop.vn")).toBe("a***@shop.vn");
    expect(maskEmail("ab@shop.vn")).toBe("a***b@shop.vn");
    expect(maskEmail("abc@shop.vn")).toBe("ab***c@shop.vn");
  });

  it("hides invalid values", () => {
    expect(maskEmail("")).toBe("***");
    expect(maskEmail(null)).toBe("***");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});
