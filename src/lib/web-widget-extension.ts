/** Ghép tiện ích Chrome với kênh Chat website — không phụ thuộc Prisma. */

import { normalizeWebsiteHost, WEB_WIDGET_KEY_PREFIX } from "@/lib/web-widget";

/** Marker trên tab Cài đặt — tiện ích chỉ đọc khi user mở popup, không nghe postMessage. */
export const WEB_WIDGET_EXTENSION_ATTR = "data-shopinbox-widget-pair";

export type WebWidgetExtensionPair = {
  appOrigin: string;
  widgetKey: string;
  websiteHost: string;
};

export function parseAppOrigin(raw: string | null | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseWebWidgetExtensionPair(raw: unknown): WebWidgetExtensionPair | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const appOrigin = parseAppOrigin(typeof row.appOrigin === "string" ? row.appOrigin : null);
  const widgetKey = typeof row.widgetKey === "string" ? row.widgetKey.trim() : "";
  const websiteHost = normalizeWebsiteHost(
    typeof row.websiteHost === "string" ? row.websiteHost : null,
  );
  if (!appOrigin || !websiteHost) return null;
  if (!widgetKey.startsWith(WEB_WIDGET_KEY_PREFIX) || widgetKey.length < 12) return null;
  return { appOrigin, widgetKey, websiteHost };
}

export function buildWebWidgetExtensionPair(input: {
  appOrigin: string;
  widgetKey: string;
  websiteHost: string;
}): WebWidgetExtensionPair | null {
  return parseWebWidgetExtensionPair(input);
}

export function isShopInboxSettingsUrl(raw: string | null | undefined) {
  try {
    const url = new URL(String(raw ?? "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.pathname === "/settings" || url.pathname.startsWith("/settings/");
  } catch {
    return false;
  }
}

function parseJsonUnknown(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Offer chỉ hợp lệ khi tab đang mở đúng origin ShopInbox (trang Cài đặt). */
export function offeredWebWidgetPairFromTab(
  tabUrl: string | null | undefined,
  attrValue: string | null | undefined,
) {
  if (!isShopInboxSettingsUrl(tabUrl)) return null;
  const tabOrigin = parseAppOrigin(tabUrl);
  const payload = parseWebWidgetExtensionPair(parseJsonUnknown(attrValue));
  if (!tabOrigin || !payload || payload.appOrigin !== tabOrigin) return null;
  return payload;
}

export function webWidgetConnectUrl(appOrigin: string, websiteHost: string) {
  const origin = parseAppOrigin(appOrigin);
  const host = normalizeWebsiteHost(websiteHost);
  if (!origin || !host) return null;
  const url = new URL("/settings", origin);
  url.searchParams.set("connect", "web");
  url.searchParams.set("web_host", host);
  return url.toString();
}
