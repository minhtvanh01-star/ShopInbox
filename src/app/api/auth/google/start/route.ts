import { NextResponse } from "next/server";
import { getSession } from "@/backend/session";
import { safeInternalPath } from "@/backend/safe-path";
import {
  buildGoogleOAuthUrl,
  createCodeChallenge,
  generateCodeVerifier,
  getGoogleOAuthConfig,
} from "@/backend/google-oauth";
import {
  GOOGLE_AUTH_STATE_COOKIE,
  GOOGLE_PKCE_COOKIE,
  createGoogleAuthStateToken,
  createGooglePkceToken,
  googleAuthCookieOptions,
  type GoogleAuthMode,
} from "@/backend/google-auth-state";
import { absoluteAppUrl } from "@/backend/public-url";

function authPageUrl(request: Request, path: "/login" | "/register", params: Record<string, string>) {
  const url = absoluteAppUrl(request, path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function parseMode(raw: string | null): GoogleAuthMode {
  if (raw === "link" || raw === "register") {
    return raw;
  }
  return "login";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = parseMode(searchParams.get("mode"));
  const fallbackPath = mode === "register" ? "/register" : "/login";

  const config = getGoogleOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      authPageUrl(request, fallbackPath, { auth_error: "google_not_configured" }),
    );
  }

  const nextPath = safeInternalPath(searchParams.get("next"));

  let staffId: string | undefined;
  if (mode === "link") {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(authPageUrl(request, "/login", { next: "/settings/profile" }));
    }
    staffId = session.staffId;
  }

  const nonce = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  try {
    const state = await createGoogleAuthStateToken({
      nonce,
      next: mode === "link" ? "/settings/profile" : nextPath,
      mode,
      staffId,
    });

    const response = NextResponse.redirect(
      buildGoogleOAuthUrl(config, { state, nonce, codeChallenge }),
    );
    const cookieOptions = googleAuthCookieOptions();
    response.cookies.set(GOOGLE_AUTH_STATE_COOKIE, state, cookieOptions);
    response.cookies.set(GOOGLE_PKCE_COOKIE, await createGooglePkceToken(codeVerifier), cookieOptions);
    return response;
  } catch (error) {
    console.error("[google-oauth] start failed", error);
    return NextResponse.redirect(
      authPageUrl(request, fallbackPath, { auth_error: "google_failed" }),
    );
  }
}
