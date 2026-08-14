import { NextResponse } from "next/server";
import { getSession } from "@/backend/session";
import { safeInternalPath } from "@/backend/safe-path";
import { buildGoogleOAuthUrl, getGoogleOAuthConfig } from "@/backend/google-oauth";
import {
  GOOGLE_AUTH_STATE_COOKIE,
  createGoogleAuthStateToken,
  type GoogleAuthMode,
} from "@/backend/google-auth-state";

function loginUrl(request: Request, params: Record<string, string>) {
  const url = new URL("/login", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(request: Request) {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      loginUrl(request, { auth_error: "google_not_configured" }),
    );
  }

  const { searchParams } = new URL(request.url);
  const modeRaw = searchParams.get("mode");
  const mode: GoogleAuthMode = modeRaw === "link" ? "link" : "login";
  const nextPath = safeInternalPath(searchParams.get("next"));

  let staffId: string | undefined;
  if (mode === "link") {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(loginUrl(request, { next: "/settings/profile" }));
    }
    staffId = session.staffId;
  }

  const state = await createGoogleAuthStateToken({
    nonce: crypto.randomUUID(),
    next: mode === "link" ? "/settings/profile" : nextPath,
    mode,
    staffId,
  });

  const response = NextResponse.redirect(buildGoogleOAuthUrl(config, state));
  response.cookies.set(GOOGLE_AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
