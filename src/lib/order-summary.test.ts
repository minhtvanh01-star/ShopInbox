import { describe, expect, it } from "vitest";
import { bucketKeyForView, bucketLabel } from "@/lib/order-summary";

describe("order-summary buckets", () => {
  it("bucket theo ngày VN", () => {
    const date = new Date("2026-09-15T10:00:00+07:00");
    expect(bucketKeyForView(date, "day")).toBe("2026-09-15");
    expect(bucketKeyForView(date, "month")).toBe("2026-09");
    expect(bucketKeyForView(date, "year")).toBe("2026");
  });

  it("nhãn tiếng Việt", () => {
    expect(bucketLabel("2026-09-15", "day")).toBe("15/09/2026");
    expect(bucketLabel("2026-09", "month")).toBe("Tháng 09/2026");
    expect(bucketLabel("2026", "year")).toBe("Năm 2026");
  });
});
