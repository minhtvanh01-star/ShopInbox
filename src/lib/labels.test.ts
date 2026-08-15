import { describe, expect, it } from "vitest";
import {
  formatDateTimeVN,
  formatTimeVN,
  parseVnDayEnd,
  parseVnDayStart,
} from "./labels";

describe("formatDateTimeVN", () => {
  it("converts a known UTC instant to Vietnam local time", () => {
    // 03:09 UTC = 10:09 Asia/Ho_Chi_Minh (UTC+7)
    expect(formatDateTimeVN("2026-08-15T03:09:00.000Z")).toBe("10:09 15/08/2026");
  });

  it("accepts Date instances", () => {
    expect(formatDateTimeVN(new Date("2026-08-14T17:00:00.000Z"))).toBe("00:00 15/08/2026");
  });
});

describe("formatTimeVN", () => {
  it("formats short time in Vietnam timezone", () => {
    expect(formatTimeVN("2026-08-15T03:09:00.000Z")).toBe("10:09 15/08");
  });
});

describe("parseVnDayStart / parseVnDayEnd", () => {
  it("maps calendar day to UTC+7 boundaries", () => {
    expect(parseVnDayStart("2026-08-15")?.toISOString()).toBe("2026-08-14T17:00:00.000Z");
    expect(parseVnDayEnd("2026-08-15")?.toISOString()).toBe("2026-08-15T16:59:59.999Z");
  });

  it("rejects invalid input", () => {
    expect(parseVnDayStart(undefined)).toBeUndefined();
    expect(parseVnDayStart("15/08/2026")).toBeUndefined();
    expect(parseVnDayEnd("")).toBeUndefined();
  });
});
