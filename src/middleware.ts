import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  shouldRefreshSession,
  verifySessionToken,
} from "@/backend/session-token";
import { absoluteAppUrl } from "@/backend/public-url";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];
const PUBLIC_PREFIXES = ["/api/webhooks/", "/api/auth/google/", "/api/auth/session-timeout"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
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
    return response;
  }

  if (
    session &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/")
  ) {
    return NextResponse.redirect(absoluteAppUrl(request, "/inbox"));
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
    });
    response.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions());
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
