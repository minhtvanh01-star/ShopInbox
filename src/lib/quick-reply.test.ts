import { describe, expect, it } from "vitest";
import { parseQuickReplyInput, QUICK_REPLY_TEXT_MAX, QUICK_REPLY_TITLE_MAX } from "./quick-reply";

describe("parseQuickReplyInput", () => {
  it("chấp nhận title + text hợp lệ", () => {
    expect(parseQuickReplyInput({ title: "  Còn hàng ", text: "Dạ còn ạ." })).toEqual({
      ok: true,
      value: { title: "Còn hàng", text: "Dạ còn ạ." },
    });
  });

  it("từ chối thiếu title / text", () => {
    expect(parseQuickReplyInput({ title: "", text: "a" }).ok).toBe(false);
    expect(parseQuickReplyInput({ title: "a", text: "  " }).ok).toBe(false);
  });

  it("từ chối quá dài", () => {
    expect(
      parseQuickReplyInput({ title: "x".repeat(QUICK_REPLY_TITLE_MAX + 1), text: "ok" }).ok,
    ).toBe(false);
    expect(
      parseQuickReplyInput({ title: "ok", text: "y".repeat(QUICK_REPLY_TEXT_MAX + 1) }).ok,
    ).toBe(false);
  });
});
