import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  shouldRefreshSession,
  verifySessionToken,
} from "@/backend/session-token";
import { absoluteAppUrl } from "@/backend/public-url";
import {
  applySecurityHeaders,
  httpsRedirectLocation,
  isLoopbackHost,
  requestUsesHttps,
  shouldEnforceHttps,
} from "@/lib/security-headers";
import {
  isCloudflareExemptPath,
  isCloudflareProxiedRequest,
  shouldRequireCloudflare,
} from "@/lib/cloudflare";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];
const PUBLIC_PREFIXES = [
  "/api/webhooks/",
  "/api/auth/google/",
  "/api/auth/session-timeout",
  "/api/health",
  "/api/cron/",
];

function withSecurityHeaders(response: NextResponse, https: boolean) {
  const production = process.env.NODE_ENV === "production";
  applySecurityHeaders(response.headers, {
    hsts: production && https,
    upgradeInsecureRequests: production,
    unsafeEval: !production,
  });
  return response;
}

function enforceHttps(request: NextRequest): NextResponse | null {
  if (!shouldEnforceHttps()) return null;

  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.nextUrl.host;
  if (isLoopbackHost(host)) return null;

  const https = requestUsesHttps({
    forwardedProto: request.headers.get("x-forwarded-proto"),
    protocol: request.nextUrl.protocol,
  });
  if (https) return null;

  if (request.method === "GET" || request.method === "HEAD") {
    return NextResponse.redirect(
      httpsRedirectLocation({
        url: request.nextUrl.toString(),
        forwardedHost: request.headers.get("x-forwarded-host"),
      }),
      308,
    );
  }

  return new NextResponse("HTTPS required", { status: 400 });
}

function enforceCloudflare(request: NextRequest): NextResponse | null {
  if (!shouldRequireCloudflare()) return null;
  const { pathname } = request.nextUrl;
  if (isCloudflareExemptPath(pathname)) return null;
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.nextUrl.host;
  if (isLoopbackHost(host)) return null;
  if (isCloudflareProxiedRequest((name) => request.headers.get(name))) return null;
  return new NextResponse("Cloudflare required", { status: 403 });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const httpsRedirect = enforceHttps(request);
  if (httpsRedirect) {
    return withSecurityHeaders(httpsRedirect, false);
  }
  const cloudflareBlock = enforceCloudflare(request);
  if (cloudflareBlock) {
    return withSecurityHeaders(cloudflareBlock, false);
  }

  const https = requestUsesHttps({
    forwardedProto: request.headers.get("x-forwarded-proto"),
    protocol: request.nextUrl.protocol,
  });

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return withSecurityHeaders(NextResponse.next(), https);
  }

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session && !isPublic && pathname !== "/") {
    const loginUrl = absoluteAppUrl(request, "/login");
    loginUrl.searchParams.set("next", pathname);
    if (token) {
      loginUrl.searchParams.set("reason", "idle");
    }
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return withSecurityHeaders(response, https);
  }

  if (session && pathname === "/login" && request.nextUrl.searchParams.get("reason") === "revoked") {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
    return withSecurityHeaders(response, https);
  }

  if (
    session &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/")
  ) {
    return withSecurityHeaders(NextResponse.redirect(absoluteAppUrl(request, "/inbox")), https);
  }

  if (session && shouldRefreshSession(session.lastActiveAt)) {
    const response = NextResponse.next();
    const refreshed = await createSessionToken({
      staffId: session.staffId,
      shopId: session.shopId,
      email: session.email,
      name: session.name,
      role: session.role,
      lastActiveAt: Date.now(),
      sessionVersion: session.sessionVersion,
    });
    response.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions());
    return withSecurityHeaders(response, https);
  }

  return withSecurityHeaders(NextResponse.next(), https);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
