import { describe, expect, it } from "vitest";
import {
  formatDateTimeVN,
  formatTimeVN,
  getInboxChannelFilters,
  inboxChannelsSubtitle,
  isCurrentMetaPickerPage,
  oauthConnectLabel,
  oauthSwitchPageLabel,
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

describe("formatChatDayLabel", () => {
  it("labels today and yesterday in Vietnam time", async () => {
    const { formatChatDayLabel } = await import("./labels");
    const now = new Date("2026-08-15T12:00:00.000Z");
    expect(formatChatDayLabel("2026-08-15T03:00:00.000Z", now)).toBe("Hôm nay");
    expect(formatChatDayLabel("2026-08-14T03:00:00.000Z", now)).toBe("Hôm qua");
    expect(formatChatDayLabel("2026-08-10T03:00:00.000Z", now)).toBe("10/08/2026");
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

describe("getInboxChannelFilters", () => {
  it("builds filters from CHANNEL_LABEL catalog", () => {
    expect(getInboxChannelFilters()).toEqual([
      { id: "all", label: "Tất cả" },
      { id: "facebook", label: "Facebook" },
      { id: "zalo", label: "Zalo" },
      { id: "instagram", label: "Instagram" },
      { id: "web", label: "Web" },
      { id: "shopify", label: "Shopify" },
    ]);
  });

  it("limits pills to active channels when provided", () => {
    expect(getInboxChannelFilters(["facebook", "zalo"])).toEqual([
      { id: "all", label: "Tất cả" },
      { id: "facebook", label: "Facebook" },
      { id: "zalo", label: "Zalo" },
    ]);
  });

  it("chỉ pill Tất cả khi chưa nối kênh nào", () => {
    expect(getInboxChannelFilters([])).toEqual([{ id: "all", label: "Tất cả" }]);
  });
});

describe("inboxChannelsSubtitle", () => {
  it("lists channel names from filters", () => {
    expect(inboxChannelsSubtitle(getInboxChannelFilters(["facebook", "web"]))).toBe(
      "Tin nhắn đồng bộ từ Facebook, Web",
    );
  });
});

describe("oauth page switch labels", () => {
  it("nối Fanpage thay vì chat Facebook cá nhân", () => {
    expect(oauthConnectLabel("facebook")).toBe("Kết nối Fanpage");
    expect(oauthSwitchPageLabel("facebook")).toBe("Đổi Fanpage");
    expect(oauthSwitchPageLabel("instagram")).toBe("Đổi trang Instagram");
  });

  it("khớp Fanpage đang dùng trong danh sách picker", () => {
    expect(
      isCurrentMetaPickerPage("facebook", { pageId: "p1" }, { pageId: "p1" }),
    ).toBe(true);
    expect(
      isCurrentMetaPickerPage("facebook", { pageId: "p2" }, { pageId: "p1" }),
    ).toBe(false);
    expect(
      isCurrentMetaPickerPage(
        "instagram",
        { pageId: "fb1", instagramId: "ig1" },
        { pageId: "ig1", linkedPageId: "fb1" },
      ),
    ).toBe(true);
  });
});
