import { createRemoteJWKSet, jwtVerify } from "jose";
import { resolveOAuthRedirectUri } from "@/backend/oauth-config";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleUserInfo = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

export type GoogleTokenResponse = {
  accessToken: string;
  idToken: string;
};

export type GoogleOAuthAuthorizeParams = {
  state: string;
  nonce: string;
  codeChallenge: string;
};

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: resolveOAuthRedirectUri(
      process.env.GOOGLE_REDIRECT_URI,
      "/api/auth/google/callback",
    ),
  };
}

export function isLocalGoogleRedirect(redirectUri: string) {
  return /localhost|127\.0\.0\.1/i.test(redirectUri);
}

export function classifyGoogleOAuthFailure(message: string) {
  const text = message.toLowerCase();
  if (text.includes("id_token") || text.includes("nonce")) return "google_id_token";
  if (text.includes("redirect_uri")) return "google_redirect";
  if (text.includes("invalid_client") || text.includes("unauthorized_client")) {
    return "google_client";
  }
  if (text.includes("invalid_grant")) return "google_grant";
  return "google_failed";
}

function base64UrlEncode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export function generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildGoogleOAuthUrl(config: GoogleOAuthConfig, params: GoogleOAuthAuthorizeParams) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${config.redirectUri}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    id_token?: string;
  };

  if (!data.access_token) {
    throw new Error("Google token response thiếu access_token");
  }
  if (!data.id_token) {
    throw new Error("Google token response thiếu id_token");
  }

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
  };
}

export function googleUserFromIdTokenPayload(payload: {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}): GoogleUserInfo {
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Google id_token thiếu sub");
  }
  if (typeof payload.email !== "string" || !payload.email.trim()) {
    throw new Error("Google id_token thiếu email");
  }

  const email = payload.email.trim().toLowerCase();
  const name =
    typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email;

  return {
    sub: payload.sub,
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

export async function verifyGoogleIdToken(
  config: GoogleOAuthConfig,
  idToken: string,
  nonce: string,
): Promise<GoogleUserInfo> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: config.clientId,
  });

  if (payload.nonce !== nonce) {
    throw new Error("Google id_token nonce không khớp");
  }

  return googleUserFromIdTokenPayload(payload);
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google userinfo failed: ${text.slice(0, 200)}`);
  }

  return googleUserFromIdTokenPayload(await response.json());
}

export function assertGoogleIdentitiesMatch(idTokenUser: GoogleUserInfo, userInfo: GoogleUserInfo) {
  if (idTokenUser.sub !== userInfo.sub || idTokenUser.email !== userInfo.email) {
    throw new Error("Google userinfo không khớp id_token");
  }
}
