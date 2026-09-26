import { describe, expect, it } from "vitest";
import {
  WEB_WIDGET_POST_LIMIT,
  canonicalWebsitePageId,
  consumeWebWidgetRateLimit,
  createWebWidgetKey,
  isWebWidgetVisitorId,
  normalizeWebsiteHost,
  parseWebWidgetInbound,
  websiteOriginAllowed,
  webWidgetCorsHeaders,
  webWidgetRateBucketKey,
  webWidgetScriptUrl,
  webWidgetSnippet,
} from "@/lib/web-widget";

describe("web widget", () => {
  it("normalizes website hosts", () => {
    expect(normalizeWebsiteHost("https://Shop.VN/path")).toBe("shop.vn");
    expect(normalizeWebsiteHost("cuahang.vn")).toBe("cuahang.vn");
    expect(normalizeWebsiteHost("")).toBeNull();
  });

  it("allows only the configured website origin", () => {
    expect(websiteOriginAllowed("https://shop.vn", "https://shop.vn/home")).toBe(true);
    expect(websiteOriginAllowed("https://evil.example", "https://shop.vn")).toBe(false);
    expect(websiteOriginAllowed(null, "https://shop.vn")).toBe(false);
  });

  it("rejects a bad visitor payload", () => {
    expect(parseWebWidgetInbound({ visitorId: "nope", text: "hi" }).ok).toBe(false);
    expect(parseWebWidgetInbound({ visitorId: "si_abcdefghijklmnop", text: "" }).ok).toBe(false);
    expect(parseWebWidgetInbound({ visitorId: "si_abcdefghijklmnop", text: "xin chào" }).ok).toBe(
      true,
    );
  });

  it("builds a snippet and a widget key", () => {
    expect(createWebWidgetKey().startsWith("siwk_")).toBe(true);
    expect(isWebWidgetVisitorId("si_abcdefghijklmnop")).toBe(true);
    expect(webWidgetSnippet("https://app.example/widget.js", "siwk_abc")).toContain("data-key=");
    expect(canonicalWebsitePageId("Shop.VN/path")).toBe("https://shop.vn");
    expect(webWidgetScriptUrl("https://app.example/")).toBe("https://app.example/widget.js");
    expect(webWidgetCorsHeaders("https://shop.vn")["Access-Control-Allow-Origin"]).toBe(
      "https://shop.vn",
    );
    expect(webWidgetCorsHeaders("https://evil.example", false)["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("rate-limits 20 posts per key+ip+visitor in a minute", () => {
    const now = 1_000_000;
    let stamps: number[] = [];
    for (let i = 0; i < WEB_WIDGET_POST_LIMIT; i += 1) {
      const result = consumeWebWidgetRateLimit(stamps, now + i, WEB_WIDGET_POST_LIMIT, 60_000);
      expect(result.ok).toBe(true);
      stamps = result.next;
    }
    expect(consumeWebWidgetRateLimit(stamps, now + 30, WEB_WIDGET_POST_LIMIT, 60_000).ok).toBe(false);
    expect(webWidgetRateBucketKey({ action: "post", key: "k", ip: "1.1.1.1", visitorId: "v" })).toBe(
      "post|k|1.1.1.1|v",
    );
  });
});
