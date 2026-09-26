/** Chat website — domain CORS + widget key (không phụ thuộc Prisma). */

export const WEB_WIDGET_VISITOR_RE = /^si_[A-Za-z0-9_-]{16,64}$/;
export const WEB_WIDGET_KEY_PREFIX = "siwk_";
export const WEB_WIDGET_TEXT_MAX = 2000;

export function normalizeWebsiteHost(raw: string | null | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.trim().toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function websiteOriginAllowed(
  requestOrigin: string | null | undefined,
  configuredDomain: string | null | undefined,
) {
  const configured = normalizeWebsiteHost(configuredDomain);
  const originHost = normalizeWebsiteHost(requestOrigin);
  if (!configured || !originHost) return false;
  return configured === originHost;
}

export function isWebWidgetVisitorId(value: string) {
  return WEB_WIDGET_VISITOR_RE.test(value.trim());
}

export function createWebWidgetVisitorId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return `si_${Buffer.from(bytes).toString("base64url")}`;
}

export function createWebWidgetKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${WEB_WIDGET_KEY_PREFIX}${Buffer.from(bytes).toString("base64url")}`;
}

export function parseWebWidgetInbound(input: {
  visitorId?: unknown;
  text?: unknown;
  name?: unknown;
  externalMessageId?: unknown;
}) {
  const visitorId = typeof input.visitorId === "string" ? input.visitorId.trim() : "";
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const externalMessageId =
    typeof input.externalMessageId === "string" ? input.externalMessageId.trim().slice(0, 80) : "";

  if (!isWebWidgetVisitorId(visitorId)) {
    return { ok: false as const, error: "visitor_id" };
  }
  if (!text || text.length > WEB_WIDGET_TEXT_MAX) {
    return { ok: false as const, error: "text" };
  }
  return {
    ok: true as const,
    visitorId,
    text,
    name: name.slice(0, 80) || undefined,
    externalMessageId: externalMessageId || undefined,
  };
}

export function canonicalWebsitePageId(raw: string | null | undefined) {
  const host = normalizeWebsiteHost(raw);
  return host ? `https://${host}` : null;
}

export function webWidgetScriptUrl(appOrigin: string) {
  return `${appOrigin.replace(/\/$/, "")}/widget.js`;
}

export function webWidgetSnippet(scriptUrl: string, key: string) {
  const src = scriptUrl.replace(/"/g, "");
  const safeKey = key.replace(/"/g, "");
  return `<script src="${src}" data-key="${safeKey}" async></script>`;
}

export const WEB_WIDGET_POST_LIMIT = 20;
export const WEB_WIDGET_POST_WINDOW_MS = 60_000;
export const WEB_WIDGET_POLL_LIMIT = 40;
export const WEB_WIDGET_POLL_WINDOW_MS = 60_000;

export function webWidgetRateBucketKey(input: {
  action: "post" | "poll";
  key: string;
  ip: string;
  visitorId: string;
}) {
  return `${input.action}|${input.key.trim()}|${input.ip.trim() || "unknown"}|${input.visitorId.trim()}`;
}

export function consumeWebWidgetRateLimit(
  timestamps: number[] | undefined,
  now: number,
  limit: number,
  windowMs: number,
): { ok: true; next: number[] } | { ok: false; next: number[] } {
  const kept = (timestamps ?? []).filter((at) => now - at < windowMs);
  if (kept.length >= limit) {
    return { ok: false, next: kept };
  }
  return { ok: true, next: [...kept, now] };
}

export function webWidgetCorsHeaders(origin: string | null | undefined, allowed = true) {
  if (!origin || !allowed) {
    return { "Cross-Origin-Resource-Policy": "cross-origin", Vary: "Origin" } as Record<string, string>;
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-ShopInbox-Key",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    Vary: "Origin",
  };
}
