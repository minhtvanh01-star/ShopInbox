/** Kiểm tra website ngoài đã dán widget chưa — không fetch, không Prisma. */

const BLOCKED_HOST =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])$|\.local$|\.internal$|\.localhost$/i;

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const OTHER_CHAT_HINTS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: "tawk", label: "Tawk", re: /tawk\.to|tawkto/i },
  { id: "crisp", label: "Crisp", re: /crisp\.chat|crisp\.im/i },
  { id: "facebook", label: "Facebook Chat", re: /customerchat|fb-customerchat|connect\.facebook\.net\/.+\/sdk/i },
  { id: "zalo", label: "Zalo OA", re: /zalo\.me\/oa|zalowidget|zalo-chat-widget/i },
  { id: "tidio", label: "Tidio", re: /tidio\.co|code\.tidio/i },
  { id: "livechat", label: "LiveChat", re: /livechatinc|cdn\.livechatinc/i },
];

export function isPrivateIpAddress(ip: string) {
  const value = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::1" || value === "0.0.0.0") return true;
  if (value.includes(":")) {
    if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  }
  const mapped = value.startsWith("::ffff:") ? value.slice(7) : value;
  if (!IPV4_RE.test(mapped)) {
    return value === "localhost";
  }
  const parts = mapped.split(".").map((item) => Number(item));
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function parseWebsiteCheckUrl(raw: string | null | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) {
    return { ok: false as const, error: "Dán link website trước." };
  }
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return { ok: false as const, error: "Link website không hợp lệ." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false as const, error: "Chỉ kiểm tra http/https công khai." };
  }
  const host = url.hostname.trim().toLowerCase();
  if (!host || BLOCKED_HOST.test(host) || isPrivateIpAddress(host)) {
    return { ok: false as const, error: "Không kiểm tra địa chỉ nội bộ / localhost." };
  }
  if (url.username || url.password) {
    return { ok: false as const, error: "Link không được chứa tài khoản." };
  }
  url.hash = "";
  return { ok: true as const, href: url.toString(), host };
}

/** Chỉ follow redirect cùng host — tránh nhảy sang IP nội bộ / host khác sau DNS. */
export function isSameWebsiteCheckHost(fromHost: string, toHost: string) {
  return fromHost.trim().toLowerCase() === toHost.trim().toLowerCase();
}

export function detectInstalledChat(
  html: string,
  input: { scriptUrl?: string | null; widgetKey?: string | null } = {},
) {
  const key = input.widgetKey?.trim() ?? "";
  const scriptUrl = input.scriptUrl?.trim() ?? "";
  const scriptHost = (() => {
    if (!scriptUrl) return "";
    try {
      return new URL(scriptUrl).host.toLowerCase();
    } catch {
      return "";
    }
  })();

  const matchedKey = Boolean(key) && html.includes(key);
  const hasWidgetScript =
    /widget\.js/i.test(html) &&
    (matchedKey ||
      (scriptHost ? html.toLowerCase().includes(scriptHost) : false) ||
      /data-key\s*=\s*["']siwk_/i.test(html) ||
      /shopinbox/i.test(html));
  const hasMarker = /data-shopinbox-widget/i.test(html);
  const shopInbox = matchedKey || hasWidgetScript || hasMarker;
  const otherChats = OTHER_CHAT_HINTS.filter((item) => item.re.test(html)).map((item) => item.label);

  return { shopInbox, matchedKey, otherChats };
}

export function formatWebsiteCheckMessage(input: {
  found: boolean;
  matchedKey: boolean;
  otherChats: string[];
  checkedUrl: string;
  fetchFailed?: boolean;
}) {
  if (input.fetchFailed) {
    return `Không tải được ${input.checkedUrl}. Site có thể chặn bot — mở tab để xem nút Chat.`;
  }
  if (input.found && input.matchedKey) {
    return `Đã thấy widget ShopInbox (đúng key) trên ${input.checkedUrl}.`;
  }
  if (input.found) {
    return `Thấy script widget trên ${input.checkedUrl} nhưng key chưa khớp snippet hiện tại.`;
  }
  if (input.otherChats.length > 0) {
    return `Chưa thấy widget ShopInbox. Site đang có chat khác: ${input.otherChats.join(", ")}.`;
  }
  return `Chưa thấy snippet trên HTML của ${input.checkedUrl}. Dán trước </body>. Theme Shopify/SPA có thể chèn bằng JS — mở site để kiểm tra nút Chat.`;
}
