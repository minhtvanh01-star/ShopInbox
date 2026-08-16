import { describe, expect, it } from "vitest";
import { clampInboxListWidth, INBOX_LIST_DEFAULT, INBOX_LIST_MAX, INBOX_LIST_MIN } from "./ui-layout";

describe("clampInboxListWidth", () => {
  it("clamps to min/max and rounds", () => {
    expect(clampInboxListWidth(100)).toBe(INBOX_LIST_MIN);
    expect(clampInboxListWidth(999)).toBe(INBOX_LIST_MAX);
    expect(clampInboxListWidth(300.6)).toBe(301);
    expect(clampInboxListWidth(Number.NaN)).toBe(INBOX_LIST_DEFAULT);
  });
});
