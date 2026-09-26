/** Chặn origin bypass khi web đã cam Cloudflare (orange cloud). */

const EXEMPT_PREFIXES = ["/api/health", "/api/cron/", "/api/webhooks/"];

export function shouldRequireCloudflare(env: {
  NODE_ENV?: string;
  CLOUDFLARE_ONLY?: string;
} = process.env) {
  return env.NODE_ENV === "production" && env.CLOUDFLARE_ONLY === "1";
}

export function isCloudflareProxiedRequest(getHeader: (name: string) => string | null | undefined) {
  return Boolean(getHeader("cf-ray")?.trim() || getHeader("cf-connecting-ip")?.trim());
}

export function isCloudflareExemptPath(pathname: string) {
  return EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}
