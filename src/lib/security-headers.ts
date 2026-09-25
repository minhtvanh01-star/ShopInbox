/** Security headers + HTTPS — dùng được từ next.config, middleware, test. */

export const HSTS_VALUE = "max-age=63072000; includeSubDomains";

const HOST_RE = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

export type SecurityHeaderOptions = {
  hsts?: boolean;
  upgradeInsecureRequests?: boolean;
  /** React Fast Refresh / Next.js dev cần eval() + websocket. Production tắt. */
  unsafeEval?: boolean;
};

export function contentSecurityPolicy(options?: {
  upgradeInsecureRequests?: boolean;
  unsafeEval?: boolean;
}) {
  const scriptSrc = options?.unsafeEval
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const connectSrc = options?.unsafeEval
    ? "connect-src 'self' https: ws: wss:"
    : "connect-src 'self' https:";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    "media-src 'self' blob: https:",
  ];
  if (options?.upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

/** Bộ đầy đủ cho production. Dev phải tắt HSTS + upgrade-insecure-requests. */
export function productionSecurityHeaders(options?: SecurityHeaderOptions) {
  const upgradeInsecureRequests = options?.upgradeInsecureRequests ?? options?.hsts !== false;
  const unsafeEval = options?.unsafeEval === true;
  const headers: Array<{ key: string; value: string }> = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy({ upgradeInsecureRequests, unsafeEval }),
    },
  ];
  if (options?.hsts !== false) {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }
  return headers;
}

export function applySecurityHeaders(headers: Headers, options?: SecurityHeaderOptions) {
  for (const item of productionSecurityHeaders(options)) {
    headers.set(item.key, item.value);
  }
}

export function shouldEnforceHttps(
  env: {
    NODE_ENV?: string;
    FORCE_HTTPS?: string;
  } = process.env,
) {
  if (env.NODE_ENV !== "production") return false;
  return env.FORCE_HTTPS !== "0";
}

export function isLoopbackHost(host: string) {
  const hostname = host.trim().split(":")[0] ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function requestUsesHttps(input: {
  forwardedProto?: string | null;
  protocol?: string | null;
}) {
  const forwarded = input.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  const protocol = (input.protocol ?? "").replace(/:$/, "").toLowerCase();
  return protocol === "https";
}

export function configuredPublicHost(env: Record<string, string | undefined> = process.env) {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim() || env.APP_URL?.trim();
  if (!raw) return null;
  try {
    const origin = new URL(raw);
    if (!origin.hostname || isLoopbackHost(origin.host)) return null;
    return origin.host;
  } catch {
    return null;
  }
}

function safeForwardedHost(raw: string | null | undefined) {
  const host = raw?.split(",")[0]?.trim();
  if (!host || !HOST_RE.test(host) || isLoopbackHost(host)) return null;
  return host;
}

export function httpsRedirectLocation(input: {
  url: string;
  forwardedHost?: string | null;
  configuredHost?: string | null;
}) {
  const next = new URL(input.url);
  next.protocol = "https:";
  const configured =
    input.configuredHost === undefined ? configuredPublicHost() : input.configuredHost;
  if (configured) {
    next.host = configured;
    if (!configured.includes(":")) {
      next.port = "";
    }
    return next;
  }
  const host = safeForwardedHost(input.forwardedHost);
  if (host) {
    next.host = host;
    if (!host.includes(":")) {
      next.port = "";
    }
  } else if (next.port === "80" || next.port === "8080") {
    next.port = "";
  }
  return next;
}
