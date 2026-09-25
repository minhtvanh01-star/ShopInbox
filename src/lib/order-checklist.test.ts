import { describe, expect, it } from "vitest";
import { parseChecklistTemplateInput } from "./order-checklist";

describe("parseChecklistTemplateInput", () => {
  it("parse label + enabled", () => {
    expect(
      parseChecklistTemplateInput({ label: "  Đã ship  ", enabled: "on", sortOrder: "2" }),
    ).toEqual({
      ok: true,
      value: { label: "Đã ship", enabled: true, sortOrder: 2 },
    });
  });

  it("từ chối label trống", () => {
    expect(parseChecklistTemplateInput({ label: "  " }).ok).toBe(false);
  });
});
