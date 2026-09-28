import { describe, expect, it } from "vitest";
import {
  buildWebWidgetExtensionPair,
  offeredWebWidgetPairFromTab,
  parseWebWidgetExtensionPair,
  webWidgetConnectUrl,
} from "./web-widget-extension";

describe("web-widget-extension", () => {
  it("chấp nhận pair hợp lệ", () => {
    expect(
      parseWebWidgetExtensionPair({
        appOrigin: "https://app.example/",
        widgetKey: "siwk_abcdefghijk",
        websiteHost: "Shop.VN/home",
      }),
    ).toEqual({
      appOrigin: "https://app.example",
      widgetKey: "siwk_abcdefghijk",
      websiteHost: "shop.vn",
    });
  });

  it("từ chối key / origin lệch", () => {
    expect(
      parseWebWidgetExtensionPair({
        appOrigin: "https://app.example",
        widgetKey: "not-a-key",
        websiteHost: "shop.vn",
      }),
    ).toBeNull();
    expect(buildWebWidgetExtensionPair({ appOrigin: "ftp://x", widgetKey: "siwk_abc", websiteHost: "a.vn" })).toBeNull();
  });

  it("mở Cài đặt với domain trang đang xem", () => {
    expect(webWidgetConnectUrl("https://app.example", "Cuahang.vn")).toBe(
      "https://app.example/settings?connect=web&web_host=cuahang.vn",
    );
  });

  it("chỉ nhận offer từ đúng tab Cài đặt ShopInbox", () => {
    const payload = JSON.stringify({
      appOrigin: "https://app.example",
      widgetKey: "siwk_abcdefghijk",
      websiteHost: "shop.vn",
    });
    expect(offeredWebWidgetPairFromTab("https://app.example/settings", payload)).toEqual({
      appOrigin: "https://app.example",
      widgetKey: "siwk_abcdefghijk",
      websiteHost: "shop.vn",
    });
    expect(offeredWebWidgetPairFromTab("https://evil.example/settings", payload)).toBeNull();
    expect(offeredWebWidgetPairFromTab("https://app.example/", payload)).toBeNull();
    expect(offeredWebWidgetPairFromTab("https://app.example/settings", "{")).toBeNull();
  });
});
