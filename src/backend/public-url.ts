import { getPublicAppUrl, normalizeAppOrigin } from "@/backend/oauth-config";

function isLocalHost(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

/**
 * Origin công khai phía client (Railway/proxy).
 * Không dùng `request.url` thuần — trên Railway thường là `http://localhost:8080`.
 */
export function getRequestOrigin(request: Request): string {
  const configured =
    normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeAppOrigin(process.env.APP_URL);
  if (configured && !isLocalHost(configured)) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    if (configured) {
      return configured;
    }
    return getPublicAppUrl();
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

  if (forwardedHost && !isLocalHost(forwardedHost)) {
    const host = forwardedHost.replace(/:\d+$/, "");
    return `${forwardedProto}://${host}`;
  }

  try {
    const fromRequest = new URL(request.url);
    if (!isLocalHost(fromRequest.hostname) || fromRequest.port === "3000" || !fromRequest.port) {
      if (fromRequest.port === "8080" && isLocalHost(fromRequest.hostname)) {
        return getPublicAppUrl();
      }
      return fromRequest.origin;
    }
  } catch {
    // fall through
  }

  return getPublicAppUrl();
}

/** Absolute URL cho redirect (path nội bộ bắt đầu bằng `/`). */
export function absoluteAppUrl(request: Request, path: string): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  try {
    return new URL(normalized, `${getRequestOrigin(request)}/`);
  } catch {
    return new URL(normalized, request.url);
  }
}
