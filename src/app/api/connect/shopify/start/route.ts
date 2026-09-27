import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/backend/rbac";
import { markChannelConnecting } from "@/backend/channel-connect";
import { getShopifyOAuthConfig, isUsableOAuthRedirectUri } from "@/backend/oauth-config";
import { OAUTH_STATE_COOKIE, createOAuthStateToken } from "@/backend/oauth-state";
import { absoluteAppUrl, getRequestOrigin } from "@/backend/public-url";
import {
  buildShopifyOAuthUrl,
  isShopifyOAuthTimestampFresh,
  normalizeShopifyShopDomain,
  verifyShopifyOAuthHmac,
} from "@/backend/shopify-oauth";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";
import { safeInternalPath } from "@/backend/safe-path";

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const config = getShopifyOAuthConfig(origin);
  const searchParams = new URL(request.url).searchParams;
  const shopDomain = normalizeShopifyShopDomain(searchParams.get("shop"));
  const hmac = searchParams.get("hmac");

  const session = await requirePermissionApi(PERMISSION_CODES.channelsConnect);

  if (!session) {
    if (
      !config ||
      !hmac ||
      !shopDomain ||
      !verifyShopifyOAuthHmac(searchParams, config.apiSecret) ||
      !isShopifyOAuthTimestampFresh(searchParams.get("timestamp"))
    ) {
      return NextResponse.redirect(absoluteAppUrl(request, "/login?next=/settings"));
    }
    const next = safeInternalPath(`/api/connect/shopify/start?shop=${encodeURIComponent(shopDomain)}`);
    return NextResponse.redirect(absoluteAppUrl(request, `/login?next=${encodeURIComponent(next)}`));
  }

  if (!config || !isUsableOAuthRedirectUri(config.redirectUri)) {
    return NextResponse.redirect(
      absoluteAppUrl(request, "/settings?oauth_error=shopify_not_configured"),
    );
  }

  if (!shopDomain) {
    return NextResponse.redirect(absoluteAppUrl(request, "/settings?oauth_error=shopify_invalid"));
  }

  if (hmac) {
    if (
      !verifyShopifyOAuthHmac(searchParams, config.apiSecret) ||
      !isShopifyOAuthTimestampFresh(searchParams.get("timestamp"))
    ) {
      return NextResponse.redirect(absoluteAppUrl(request, "/settings?oauth_error=shopify_invalid"));
    }
  }

  await markChannelConnecting(session.shopId, "shopify");

  const state = await createOAuthStateToken({
    shopId: session.shopId,
    channel: "shopify",
    nonce: crypto.randomUUID(),
    shopDomain,
  });

  const response = NextResponse.redirect(buildShopifyOAuthUrl(config, shopDomain, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
  return response;
}
