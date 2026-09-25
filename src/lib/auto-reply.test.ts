import { describe, expect, it } from "vitest";
import {
  formatHourMinute,
  isWithinBusinessHours,
  parseAutoReplyRuleInput,
  parseHourMinute,
  pickAutoReplyText,
  textMatchesKeywords,
  vietnamMinuteOfDay,
} from "./auto-reply";

describe("parseHourMinute / formatHourMinute", () => {
  it("parse HH:MM", () => {
    expect(parseHourMinute("09:00")).toBe(540);
    expect(parseHourMinute("18:30")).toBe(1110);
    expect(parseHourMinute("25:00")).toBeNull();
  });

  it("format round-trip", () => {
    expect(formatHourMinute(540)).toBe("09:00");
  });
});

describe("isWithinBusinessHours", () => {
  it("cùng ngày", () => {
    expect(isWithinBusinessHours(540, 1080, 600)).toBe(true);
    expect(isWithinBusinessHours(540, 1080, 200)).toBe(false);
  });

  it("qua đêm", () => {
    expect(isWithinBusinessHours(22 * 60, 8 * 60, 23 * 60)).toBe(true);
    expect(isWithinBusinessHours(22 * 60, 8 * 60, 10 * 60)).toBe(false);
  });
});

describe("textMatchesKeywords", () => {
  it("khớp từ (không phân biệt hoa thường), không khớp chuỗi con", () => {
    expect(textMatchesKeywords("Shop ơi giá bao nhiêu", "giá, ship")).toBe(true);
    expect(textMatchesKeywords("Xin chào", "giá")).toBe(false);
    expect(textMatchesKeywords("shipper giao hôm nay", "ship")).toBe(false);
    expect(textMatchesKeywords("giảm 10%", "giá")).toBe(false);
  });
});

describe("pickAutoReplyText", () => {
  const base = {
    enabled: true,
    openMinute: 9 * 60,
    closeMinute: 18 * 60,
    sortOrder: 0,
    replyText: "",
    keywords: "",
    kind: "keyword",
  };

  it("ưu tiên keyword trước off_hours", () => {
    const text = pickAutoReplyText({
      customerText: "Cho hỏi giá nhé",
      now: new Date("2026-09-15T14:00:00+07:00"),
      rules: [
        {
          ...base,
          kind: "off_hours",
          replyText: "Ngoài giờ",
          openMinute: 9 * 60,
          closeMinute: 18 * 60,
          sortOrder: 0,
        },
        {
          ...base,
          kind: "keyword",
          keywords: "giá",
          replyText: "Bảng giá đây ạ",
          sortOrder: 1,
        },
      ],
    });
    expect(text).toBe("Bảng giá đây ạ");
  });

  it("off_hours khi ngoài giờ làm việc", () => {
    const text = pickAutoReplyText({
      customerText: "Hello",
      now: new Date("2026-09-15T21:00:00+07:00"),
      rules: [
        {
          ...base,
          kind: "off_hours",
          replyText: "Shop nghỉ, mai trả lời ạ",
          openMinute: 9 * 60,
          closeMinute: 18 * 60,
        },
      ],
    });
    expect(text).toBe("Shop nghỉ, mai trả lời ạ");
  });

  it("không off_hours trong giờ", () => {
    const text = pickAutoReplyText({
      customerText: "Hello",
      now: new Date("2026-09-15T10:00:00+07:00"),
      rules: [
        {
          ...base,
          kind: "off_hours",
          replyText: "Ngoài giờ",
          openMinute: 9 * 60,
          closeMinute: 18 * 60,
        },
      ],
    });
    expect(text).toBeNull();
  });
});

describe("parseAutoReplyRuleInput", () => {
  it("keyword hợp lệ", () => {
    const parsed = parseAutoReplyRuleInput({
      kind: "keyword",
      keywords: "giá, ship",
      replyText: "Dạ shop gửi bảng giá",
      cooldownMinutes: 60,
      enabled: "on",
    });
    expect(parsed.ok).toBe(true);
  });

  it("off_hours cần giờ", () => {
    expect(
      parseAutoReplyRuleInput({
        kind: "off_hours",
        replyText: "Ngoài giờ",
        openTime: "09:00",
        closeTime: "18:00",
      }).ok,
    ).toBe(true);
    expect(
      parseAutoReplyRuleInput({
        kind: "off_hours",
        replyText: "Ngoài giờ",
        openTime: "bad",
        closeTime: "18:00",
      }).ok,
    ).toBe(false);
  });
});

describe("vietnamMinuteOfDay", () => {
  it("trả số phút hợp lệ", () => {
    const m = vietnamMinuteOfDay(new Date("2026-09-15T03:30:00.000Z"));
    expect(m).toBe(10 * 60 + 30);
  });
});
