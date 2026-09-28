/** Tiện ích Chrome mở Inbox Nexo — không phụ thuộc Prisma. */

import { parseAppOrigin } from "@/lib/web-widget-extension";

export { parseAppOrigin };

/** Marker mọi trang Nexo — tiện ích chỉ gắn origin khi khớp tab đang mở. */
export const NEXO_EXTENSION_ATTR = "data-nexo-app-origin";

export function nexoInboxUrl(appOrigin: string | null | undefined) {
  const origin = parseAppOrigin(appOrigin);
  if (!origin) return null;
  return `${origin}/inbox`;
}

/** Chỉ nhận origin khi trang tự đánh dấu và trùng tab (không gắn Facebook / site lạ). */
export function offeredNexoAppOriginFromTab(
  tabUrl: string | null | undefined,
  attrValue: string | null | undefined,
) {
  const tabOrigin = parseAppOrigin(tabUrl);
  const marked = parseAppOrigin(attrValue);
  if (!tabOrigin || !marked || tabOrigin !== marked) return null;
  return tabOrigin;
}
