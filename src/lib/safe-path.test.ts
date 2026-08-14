import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safe-path";

describe("safeInternalPath", () => {
  it("keeps valid internal paths", () => {
    expect(safeInternalPath("/inbox")).toBe("/inbox");
    expect(safeInternalPath("/staff")).toBe("/staff");
    expect(safeInternalPath("/orders?tab=1")).toBe("/orders?tab=1");
  });

  it("blocks open redirects", () => {
    expect(safeInternalPath("//evil.com")).toBe("/inbox");
    expect(safeInternalPath("https://evil.com")).toBe("/inbox");
    expect(safeInternalPath("/\\evil.com")).toBe("/inbox");
    expect(safeInternalPath("inbox")).toBe("/inbox");
  });

  it("uses custom fallback", () => {
    expect(safeInternalPath(null, "/login")).toBe("/login");
  });
});
